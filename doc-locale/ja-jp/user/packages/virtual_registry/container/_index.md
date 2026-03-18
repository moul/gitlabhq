---
stage: Package
group: Container Registry
info: To determine the technical writer assigned to the Stage/Group associated with this page, see <https://handbook.gitlab.com/handbook/product/ux/technical-writing/#assignments>
title: コンテナ仮想レジストリ
description: コンテナ仮想レジストリを使用して、アップストリームレジストリからコンテナイメージをキャッシュします。
---

{{< details >}}

- プラン: Premium、Ultimate
- 提供形態: GitLab.com、GitLab Self-Managed
- ステータス: ベータ版

{{< /details >}}

{{< history >}}

- GitLab 18.5で`container_virtual_registries`[フラグ](../../../../administration/feature_flags/_index.md)とともに[導入](https://gitlab.com/gitlab-org/gitlab/-/issues/548794)されました。デフォルトでは無効になっています。
- GitLab 18.9で、実験版からベータ版に[変更](https://gitlab.com/gitlab-org/gitlab/-/work_items/589631)されました。
- GitLab 18.10で[GitLab.com、GitLab Self-Managed、GitLab Dedicatedで有効](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/224250)になりました。

{{< /history >}}

> [!flag]
> この機能の利用可否は、機能フラグによって制御されます。詳細については、履歴を参照してください。

GitLabのコンテナ仮想レジストリは、アップストリームレジストリからコンテナイメージをキャッシュするために使用できるローカルプロキシです。これはプルスルーキャッシュとして機能し、頻繁にアクセスされるイメージをローカルに保存することで、帯域幅の使用量を削減し、ビルドパフォーマンスを向上させます。

## 前提条件 {#prerequisites}

コンテナ仮想レジストリを使用する前に:

- 仮想レジストリを使用するための[前提条件](../_index.md#prerequisites)を確認してください。

コンテナ仮想レジストリを使用する際は、以下の制限事項に注意してください:

- トップレベルグループごとに最大`5`つのコンテナ仮想レジストリを作成できます。
- 1つのコンテナ仮想レジストリに対して、`5`つのアップストリームのみ設定できます。
- 技術的な理由により、[オブジェクトストレージの設定](../../../../administration/object_storage.md#proxy-download)にどのような値が設定されていても、`proxy_download`設定は強制的に有効になります。
- Geoサポートは実装されていません。

## 仮想レジストリを管理する {#manage-virtual-registries}

コンテナ仮想レジストリを作成、編集、または削除するには、[コンテナ仮想レジストリAPI](../../../../api/container_virtual_registries.md)を参照してください。

## コンテナ仮想レジストリで認証する {#authenticate-with-the-container-virtual-registry}

コンテナ仮想レジストリは、トップレベルグループに関連付けられたレジストリにコンテナイメージを保存し、関連付けます。コンテナイメージにアクセスするには、グループのコンテナ仮想レジストリで認証する必要があります。

手動で認証するには、次のコマンドを実行します:

```shell
echo "$CONTAINER_REGISTRY_PASSWORD" | docker login gitlab.example.com/virtual_registries/container/1 --username <your_username> --password-stdin
```

または、[仮想レジストリで認証する](../_index.md#authenticate-to-the-virtual-registry)で説明されているいずれかの方法で認証を設定します。

コンテナ仮想レジストリは、[Docker v2トークン認証フロー](https://distribution.github.io/distribution/spec/auth/token/)に従います:

1. クライアントの認証後、クライアントに発行されたJWTトークンは、クライアントがコンテナイメージをプルすることを許可します。
1. その有効期限に従ってトークンの期限が切れます。
1. トークンの期限が切れると、ほとんどのDockerクライアントはユーザー認証情報を保存し、それ以上のアクションなしに自動的に新しいトークンをリクエストします。

## 仮想レジストリからコンテナイメージをプルする {#pull-container-images-from-the-virtual-registry}

仮想レジストリを介してコンテナイメージをプルするには:

1. 仮想レジストリで認証します。
1. 仮想レジストリのURL形式を使用してイメージをプルします:

   ```plaintext
   gitlab.example.com/virtual_registries/container/<registry_id>/<image_path>:<tag>
   ```

例: 

- タグでイメージをプルする:

  ```shell
  docker pull gitlab.example.com/virtual_registries/container/1/library/alpine:latest
  ```

- ダイジェストでイメージをプルする:

  ```shell
  docker pull gitlab.example.com/virtual_registries/container/1/library/alpine@sha256:c9375e662992791e3f39e919b26f510e5254b42792519c180aad254e6b38f4dc
  ```

- `Dockerfile`でイメージをプルする:

  ```dockerfile
  FROM gitlab.example.com/virtual_registries/container/1/library/alpine:latest
  ```

- `.gitlab-ci.yml`ファイルでイメージをプルする:

  ```yaml
  image: gitlab.example.com/virtual_registries/container/1/library/alpine:latest
  ```

イメージをプルすると、仮想レジストリは:

1. イメージがすでにキャッシュされているか確認します。
   1. イメージがキャッシュされており、アップストリームの`cache_validity_hours`設定に基づいてまだ有効な場合、イメージはキャッシュから提供されます。
   1. イメージがキャッシュされていない場合、またはキャッシュが無効な場合、イメージは設定されたアップストリームレジストリからフェッチされ、キャッシュされます。
1. あなたのDockerクライアントにイメージを提供します。

### イメージの仮想レジストリキャッシュ検証 {#virtual-registry-cache-validation-for-images}

`alpine:latest`のようなイメージタグは、常にイメージの最新バージョンをプルします。新しいバージョンには、更新されたイメージマニフェストが含まれています。コンテナ仮想レジストリは、マニフェストが変更されても新しいイメージをプルしません。

その代わりに、コンテナ仮想レジストリは:

1. イメージマニフェストが無効になる時期を判断するために、アップストリームの`cache_validity_hours`設定を確認します。
1. アップストリームにHEADリクエストを送信します。マニフェストが無効な場合、新しいイメージがプルされます。

たとえば、あなたのパイプラインが`node:latest`をプルし、`cache_validity_period`を24時間に設定している場合、仮想レジストリはイメージをキャッシュし、キャッシュの期限が切れるか、`node:latest`がアップストリームで変更されたときに更新します。

## トラブルシューティング {#troubleshooting}

### 認証エラー: `HTTP Basic: Access Denied` {#authentication-error-http-basic-access-denied}

仮想レジストリに対して認証する際に`HTTP Basic: Access denied`エラーが表示された場合は、[2要素認証トラブルシューティング](../../../profile/account/two_factor_authentication_troubleshooting.md#error-http-basic-access-denied-if-a-password-was-provided-for-git-authentication-)を参照してください。

### 仮想レジストリ接続の失敗 {#virtual-registry-connection-failure}

サービスエイリアスが設定されていない場合、`docker:20.10.16`イメージは`dind`サービスを見つけることができず、次のようなエラーが発生します:

```plaintext
error during connect: Get http://docker:2376/v1.39/info: dial tcp: lookup docker on 192.168.0.1:53: no such host
```

このエラーを解決するには、Dockerサービスにサービスエイリアスを設定します:

```yaml
services:
  - name: docker:20.10.16-dind
    alias: docker
```

### CI/CDジョブからの仮想レジストリ認証の問題 {#virtual-registry-authentication-issues-from-cicd-jobs}

GitLab Runnerは、CI/CDジョブトークンを使用して自動的に認証します。ただし、基盤となるDockerエンジンは、引き続き[承認解決プロセス](https://docs.gitlab.com/runner/configuration/advanced-configuration/#precedence-of-docker-authorization-resolving)の対象となります。

認証メカニズムの設定ミスにより、`HTTP Basic: Access denied`および`403: Access forbidden`エラーが発生する可能性があります。

仮想レジストリに対して認証するために使用される認証メカニズムをジョブログで確認できます:

```plaintext
Authenticating with credentials from $DOCKER_AUTH_CONFIG
```

```plaintext
Authenticating with credentials from /root/.docker/config.json
```

```plaintext
Authenticating with credentials from job payload (GitLab Registry)
```

想定される認証メカニズムを使用していることを確認してください。

### イメージのプル時の`Not Found`または`404`エラー {#not-found-or-404-error-when-pulling-image}

このようなエラーは、以下を示している可能性があります:

- ジョブを実行しているユーザーが、仮想レジストリを所有するグループのゲスト、プランナー、レポーター、デベロッパー、メンテナー、またはオーナーのロールを持っていません。
- URL内の仮想レジストリIDが間違っています。
- アップストリームレジストリに、リクエストされたイメージが含まれていません。
- 仮想レジストリには、アップストリームが設定されていません。

エラーメッセージの例:

```plaintext
ERROR: gitlab.example.com/virtual_registries/container/1/library/alpine:latest: not found
```

```plaintext
ERROR: Job failed: failed to pull image "gitlab.example.com/virtual_registries/container/1/library/alpine:latest" with specified policies [always]:
Error response from daemon: error parsing HTTP 404 response body: unexpected end of JSON input: "" (manager.go:237:1s)
```

これらのエラーを解決するには:

1. グループのゲスト、プランナー、レポーター、デベロッパー、メンテナー、またはオーナーのロールを持っていることを確認してください。
1. 仮想レジストリIDが正しいことを確認します。
1. 仮想レジストリに少なくとも1つのアップストリームが設定されていることを確認します。
1. イメージがアップストリームレジストリに存在することを確認します。
