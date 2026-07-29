# Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY main.go ./

# Build a static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o agent_bin main.go

# Run Stage (Lightweight Alpine)
FROM alpine:latest
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the pre-built binary from the builder stage
COPY --from=builder /app/agent_bin .

# Expose the WebSocket port
EXPOSE 8080

# Run the binary
CMD ["./agent_bin"]
