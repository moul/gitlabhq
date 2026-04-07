package loadshedding

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"gitlab.com/gitlab-org/gitlab/workhorse/internal/config"
	"gitlab.com/gitlab-org/gitlab/workhorse/internal/puma"
)

func TestLoadSheddingMiddlewareSheds(t *testing.T) {
	logger := logrus.New()
	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 0,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	// Set up shedder to shed load
	controlResp := &puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{
				Index:  0,
				Booted: true,
				LastStatus: puma.WorkerStatus{
					Backlog: 150,
				},
			},
		},
	}
	shedder.UpdateBacklog(controlResp)

	// Create a simple handler that would normally succeed
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := Middleware(shedder, nil, logger)
	handler := middleware(nextHandler)

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should return 503
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	assert.Equal(t, "0", w.Header().Get("Retry-After"))
}

func TestLoadSheddingMiddlewareAllows(t *testing.T) {
	logger := logrus.New()
	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 0,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	// Set up shedder to NOT shed load
	controlResp := &puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{
				Index:  0,
				Booted: true,
				LastStatus: puma.WorkerStatus{
					Backlog: 50,
				},
			},
		},
	}
	shedder.UpdateBacklog(controlResp)

	// Create a simple handler
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := Middleware(shedder, nil, logger)
	handler := middleware(nextHandler)

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should return 200 from next handler
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "OK", w.Body.String())
}

func TestLoadSheddingMiddlewareNilShedder(t *testing.T) {
	logger := logrus.New()

	// Create a simple handler
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := Middleware(nil, nil, logger)
	handler := middleware(nextHandler)

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should pass through to next handler
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "OK", w.Body.String())
}

func TestLoadSheddingMiddlewareRetryableMethods(t *testing.T) {
	logger := logrus.New()
	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 0,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	// Set up shedder to shed load
	controlResp := &puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{
				Index:  0,
				Booted: true,
				LastStatus: puma.WorkerStatus{
					Backlog: 150,
				},
			},
		},
	}
	shedder.UpdateBacklog(controlResp)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := Middleware(shedder, nil, logger)
	handler := middleware(nextHandler)

	t.Run("non-retryable methods should not be shed", func(t *testing.T) {
		for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
			t.Run(method, func(t *testing.T) {
				req := httptest.NewRequest(method, "/api/test", nil)
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, req)
				assert.Equal(t, http.StatusOK, w.Code)
				assert.Empty(t, w.Header().Get("Retry-After"))
			})
		}
	})

	t.Run("retryable methods should be shed", func(t *testing.T) {
		for _, method := range []string{http.MethodGet, http.MethodHead, http.MethodOptions} {
			t.Run(method, func(t *testing.T) {
				req := httptest.NewRequest(method, "/api/test", nil)
				w := httptest.NewRecorder()
				handler.ServeHTTP(w, req)
				assert.Equal(t, http.StatusServiceUnavailable, w.Code)
				assert.Equal(t, "0", w.Header().Get("Retry-After"))
			})
		}
	})
}

func TestLoadSheddingMiddlewareLogsWhenShedding(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := logrus.New()
	logger.Out = buf
	logger.Level = logrus.DebugLevel

	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 30,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	shedder.UpdateBacklog(&puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{Index: 0, Booted: true, LastStatus: puma.WorkerStatus{Backlog: 150}},
		},
	})

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(shedder, nil, logger)(nextHandler)

	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	logOutput := buf.String()
	assert.Contains(t, logOutput, "Shedding load")
	assert.Contains(t, logOutput, "backlog=150")
	assert.Contains(t, logOutput, "threshold=100")
	assert.Contains(t, logOutput, "retry_after=30")
	assert.Contains(t, logOutput, "path=/api/projects")
	assert.Contains(t, logOutput, "method=GET")
}

func TestLoadSheddingMiddlewareDoesNotLogWhenAllowed(t *testing.T) {
	buf := &bytes.Buffer{}
	logger := logrus.New()
	logger.Out = buf
	logger.Level = logrus.DebugLevel

	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 0,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	shedder.UpdateBacklog(&puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{Index: 0, Booted: true, LastStatus: puma.WorkerStatus{Backlog: 50}},
		},
	})

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := Middleware(shedder, nil, logger)(nextHandler)

	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotContains(t, buf.String(), "Shedding load")
}

func TestLoadSheddingMiddlewareCustomStatusCode(t *testing.T) {
	logger := logrus.New()
	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 0,
		StatusCode:        529,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	// Set up shedder to shed load
	controlResp := &puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{
				Index:  0,
				Booted: true,
				LastStatus: puma.WorkerStatus{
					Backlog: 150,
				},
			},
		},
	}
	shedder.UpdateBacklog(controlResp)

	// Create a simple handler that would normally succeed
	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	middleware := Middleware(shedder, nil, logger)
	handler := middleware(nextHandler)

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should return custom status code 529
	assert.Equal(t, 529, w.Code)
	assert.Equal(t, "0", w.Header().Get("Retry-After"))
}

// stubReadiness is a minimal ReadinessProvider for tests.
type stubReadiness struct {
	ready        bool
	shuttingDown bool
	timedOut     bool
}

func (s *stubReadiness) IsReady() bool               { return s.ready }
func (s *stubReadiness) IsShuttingDown() bool        { return s.shuttingDown }
func (s *stubReadiness) LastFailureWasTimeout() bool { return s.timedOut }

func TestLoadSheddingMiddlewareNotReadySheds(t *testing.T) {
	logger := logrus.New()
	reg := prometheus.NewRegistry()
	cfg := &config.LoadSheddingConfig{
		BacklogThreshold:  100,
		BacklogHysteresis: 0.8,
		RetryAfterSeconds: 5,
		StatusCode:        http.StatusServiceUnavailable,
	}
	shedder := NewLoadShedder(cfg, logger, reg)
	shedder.InitializeMetrics()

	// Backlog is below threshold — would not shed on its own.
	controlResp := &puma.ControlResponse{
		Workers:       1,
		BootedWorkers: 1,
		WorkerStatus: []puma.Worker{
			{Index: 0, Booted: true, LastStatus: puma.WorkerStatus{Backlog: 10}},
		},
	}
	shedder.UpdateBacklog(controlResp)

	nextHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	t.Run("not ready with timeout sheds retryable requests", func(t *testing.T) {
		handler := Middleware(shedder, &stubReadiness{ready: false, timedOut: true}, logger)(nextHandler)
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusServiceUnavailable, w.Code)
		assert.Equal(t, "5", w.Header().Get("Retry-After"))
	})

	t.Run("not ready with timeout does not shed non-retryable requests", func(t *testing.T) {
		handler := Middleware(shedder, &stubReadiness{ready: false, timedOut: true}, logger)(nextHandler)
		req := httptest.NewRequest(http.MethodPost, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("not ready due to fast failure does not shed", func(t *testing.T) {
		// A fast failure (e.g. TCP connection refused) means the worker is not
		// yet up, not that it is overloaded — do not shed load in this case.
		handler := Middleware(shedder, &stubReadiness{ready: false, timedOut: false}, logger)(nextHandler)
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("ready allows retryable requests", func(t *testing.T) {
		handler := Middleware(shedder, &stubReadiness{ready: true}, logger)(nextHandler)
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("not ready during shutdown does not shed", func(t *testing.T) {
		// During graceful shutdown, isReady is also false, but we must not
		// shed load so that in-flight requests can drain normally.
		handler := Middleware(shedder, &stubReadiness{ready: false, timedOut: true, shuttingDown: true}, logger)(nextHandler)
		req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	})
}
