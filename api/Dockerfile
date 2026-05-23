FROM golang:1.23-alpine AS build

ARG GIT_COMMIT=unknown
ARG BUILD_TIME=
ARG APP_ENV=dev

WORKDIR /src
COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=
ARG APP_ENV=dev
ENV BST_GIT_COMMIT=$GIT_COMMIT \
    BST_BUILD_TIME=$BUILD_TIME \
    BST_APP_ENV=$APP_ENV

RUN adduser -D -H app
USER app
WORKDIR /app
COPY --from=build /out/server /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]
