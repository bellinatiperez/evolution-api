#!/bin/bash

# Evolution API - Docker Deployment Script
# This script builds and runs the complete Evolution API with all dependencies

set -e

echo "🚀 Evolution API - Docker Deployment"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed. Please install docker-compose and try again."
    exit 1
fi

print_status "Checking environment files..."

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    print_warning ".env.docker not found. Creating from .env.example..."
    cp .env.example .env.docker
    print_warning "Please review and update .env.docker with your configuration before running again."
    exit 1
fi

print_success "Environment file found: .env.docker"

# Parse command line arguments
PROFILE=""
BUILD_FLAG=""
DETACH_FLAG="-d"

while [[ $# -gt 0 ]]; do
    case $1 in
        --with-nginx)
            PROFILE="--profile nginx"
            print_status "Including Nginx reverse proxy"
            shift
            ;;
        --with-monitoring)
            PROFILE="$PROFILE --profile monitoring"
            print_status "Including monitoring stack (Prometheus + Grafana)"
            shift
            ;;
        --with-rabbitmq)
            PROFILE="$PROFILE --profile rabbitmq"
            print_status "Including RabbitMQ message broker"
            shift
            ;;
        --build)
            BUILD_FLAG="--build"
            print_status "Force rebuilding images"
            shift
            ;;
        --logs)
            DETACH_FLAG=""
            print_status "Running in foreground with logs"
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --with-nginx      Include Nginx reverse proxy"
            echo "  --with-monitoring Include Prometheus and Grafana"
            echo "  --with-rabbitmq   Include RabbitMQ message broker"
            echo "  --build           Force rebuild Docker images"
            echo "  --logs            Run in foreground and show logs"
            echo "  --help            Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Basic setup"
            echo "  $0 --with-nginx --with-monitoring    # Full setup with proxy and monitoring"
            echo "  $0 --build --logs                     # Rebuild and show logs"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_status "Stopping any existing containers..."
docker-compose -f docker-compose.complete.yml down

print_status "Pulling latest base images..."
docker-compose -f docker-compose.complete.yml pull

print_status "Building and starting services..."
if [ -n "$PROFILE" ]; then
    docker-compose -f docker-compose.complete.yml $PROFILE up $BUILD_FLAG $DETACH_FLAG
else
    docker-compose -f docker-compose.complete.yml up $BUILD_FLAG $DETACH_FLAG
fi

if [ "$DETACH_FLAG" = "-d" ]; then
    print_success "Evolution API is starting up!"
    echo ""
    echo "📋 Service Information:"
    echo "======================"
    echo "🌐 Evolution API: http://localhost:8080"
    echo "📱 Manager UI: http://localhost:8080/manager"
    echo "🔑 API Key: 429683C4C977415CAAFCCE10F7D57E11"
    echo ""
    
    if [[ "$PROFILE" == *"nginx"* ]]; then
        echo "🔒 Nginx Proxy: http://localhost (port 80)"
    fi
    
    if [[ "$PROFILE" == *"monitoring"* ]]; then
        echo "📊 Prometheus: http://localhost:9090"
        echo "📈 Grafana: http://localhost:3000 (admin/grafana123)"
    fi
    
    if [[ "$PROFILE" == *"rabbitmq"* ]]; then
        echo "🐰 RabbitMQ Management: http://localhost:15672 (evolution/rabbitmq123)"
    fi
    
    echo ""
    echo "📝 Useful Commands:"
    echo "=================="
    echo "View logs:           docker-compose -f docker-compose.complete.yml logs -f"
    echo "Stop services:       docker-compose -f docker-compose.complete.yml down"
    echo "Restart API:         docker-compose -f docker-compose.complete.yml restart evolution-api"
    echo "Check status:        docker-compose -f docker-compose.complete.yml ps"
    echo ""
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    # Health check
    print_status "Performing health check..."
    if curl -f -s http://localhost:8080/ > /dev/null; then
        print_success "Evolution API is healthy and ready!"
    else
        print_warning "API might still be starting up. Check logs if issues persist."
        echo "Run: docker-compose -f docker-compose.complete.yml logs evolution-api"
    fi
fi