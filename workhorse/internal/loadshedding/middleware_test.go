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

	middleware := Middleware(shedder, logger)
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

	middleware := Middleware(shedder, logger)
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

	middleware := Middleware(nil, logger)
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

	middleware := Middleware(shedder, logger)
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

	handler := Middleware(shedder, logger)(nextHandler)

	req := httptest.NewRequest("GET", "/api/projects", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)

	logOutput := buf.String()
	assert.Contains(t, logOutput, "Shedding load due to high backlog")
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

	handler := Middleware(shedder, logger)(nextHandler)

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

	middleware := Middleware(shedder, logger)
	handler := middleware(nextHandler)

	// Make request
	req := httptest.NewRequest("GET", "/api/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	// Should return custom status code 529
	assert.Equal(t, 529, w.Code)
	assert.Equal(t, "0", w.Header().Get("Retry-After"))
}
