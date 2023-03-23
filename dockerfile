FROM denoland/deno:alpine-1.32.0 AS deno-build

COPY . /build/
RUN apk add unzip
WORKDIR /build
RUN deno task build-linux

FROM denoland/deno:alpine-1.32.0

COPY --from=deno-build /build/bin/redirect /app/redirect
WORKDIR /app
ENTRYPOINT [ "/app/redirect" ] 
