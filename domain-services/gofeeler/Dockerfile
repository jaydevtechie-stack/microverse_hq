# Step 1: Build stage
FROM golang:alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum first to cache dependencies
COPY app/go.mod app/go.sum ./
RUN go mod download

# Copy the rest of the application code
COPY app/ .

# Install dependencies (Gin in this case)
RUN go get github.com/gin-gonic/gin

# Build the binary
RUN go build -o gofeeler main.go

# Step 2: Final image
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/


# Copy the binary from the builder stage
COPY --from=builder /app/gofeeler /usr/local/bin/gofeeler

RUN ls -la /usr/local/bin/

EXPOSE 8082

# Run the binary
CMD ["gofeeler"]
