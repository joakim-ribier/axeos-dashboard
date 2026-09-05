FROM golang:1.24-alpine AS build
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ .
ARG GIT_SHA=dev
RUN CGO_ENABLED=0 go build -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=${GIT_SHA}" -o /out/dashboard-api ./cmd/dashboard-api
RUN CGO_ENABLED=0 go build -ldflags "-X github.com/joakimribier/axeos-bitaxe-dashboard/server/internal/version.GitSHA=${GIT_SHA}" -o /out/feeder ./cmd/feeder

FROM alpine:3.20
COPY --from=build /out/dashboard-api /out/feeder /usr/local/bin/
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
