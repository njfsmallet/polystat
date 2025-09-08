#!/bin/bash

# PolyStat Dashboard Development Startup Script
# This script sets up and starts the PolyStat Dashboard development environment

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly BACKEND_DIR="${SCRIPT_DIR}/polystat-backend"
readonly FRONTEND_DIR="${SCRIPT_DIR}/polystat-frontend"
readonly BACKEND_PORT=8000
readonly FRONTEND_PORT=3000

# Process IDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Error handling
handle_error() {
    local exit_code=$?
    log_error "Script failed with exit code $exit_code"
    cleanup
    exit $exit_code
}

trap handle_error ERR

# Cleanup function
cleanup() {
    log_info "Stopping services..."
    
    if [[ -n "$BACKEND_PID" ]]; then
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            kill "$BACKEND_PID" 2>/dev/null
            log_success "Backend stopped"
        fi
    fi
    
    if [[ -n "$FRONTEND_PID" ]]; then
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            kill "$FRONTEND_PID" 2>/dev/null
            log_success "Frontend stopped"
        fi
    fi
}

# Signal handling
trap cleanup SIGINT SIGTERM

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if port is available
port_available() {
    local port=$1
    ! nc -z localhost "$port" 2>/dev/null
}

# Validate dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install it first."
        exit 1
    fi
    
    if ! command_exists python3; then
        log_error "Python 3 is not installed. Please install it first."
        exit 1
    fi
    
    if ! command_exists npm; then
        log_error "npm is not installed. Please install it first."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Validate project structure
validate_project_structure() {
    log_info "Validating project structure..."
    
    if [[ ! -d "$BACKEND_DIR" ]]; then
        log_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        log_error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi
    
    if [[ ! -f "${BACKEND_DIR}/env.example" ]]; then
        log_error "Example configuration file missing: ${BACKEND_DIR}/env.example"
        exit 1
    fi
    
    log_success "Project structure is valid"
}

# Setup backend environment
setup_backend() {
    log_info "Setting up backend environment..."
    
    cd "$BACKEND_DIR"
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        log_info "Creating .env file from template..."
        cp env.example .env
        log_warning "Please configure the .env file according to your needs"
    fi
    
    # Create virtual environment if it doesn't exist
    if [[ ! -d "venv" ]]; then
        log_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    log_info "Installing Python dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
    
    cd "$SCRIPT_DIR"
    log_success "Backend environment setup complete"
}

# Setup frontend environment
setup_frontend() {
    log_info "Setting up frontend environment..."
    
    cd "$FRONTEND_DIR"
    
    # Install dependencies if node_modules doesn't exist
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing Node.js dependencies..."
        npm install
    fi
    
    cd "$SCRIPT_DIR"
    log_success "Frontend environment setup complete"
}

# Check port availability
check_ports() {
    log_info "Checking port availability..."
    
    if ! port_available $BACKEND_PORT; then
        log_error "Backend port $BACKEND_PORT is already in use"
        exit 1
    fi
    
    if ! port_available $FRONTEND_PORT; then
        log_error "Frontend port $FRONTEND_PORT is already in use"
        exit 1
    fi
    
    log_success "Ports are available"
}

# Start backend
start_backend() {
    log_info "Starting FastAPI backend..."
    
    cd "$BACKEND_DIR"
    source venv/bin/activate
    
    # Start backend in background
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT > backend.log 2>&1 &
    BACKEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # Wait a moment for backend to start
    sleep 2
    
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        log_success "Backend started successfully (PID: $BACKEND_PID)"
    else
        log_error "Failed to start backend"
        exit 1
    fi
}

# Start frontend
start_frontend() {
    log_info "Starting React frontend..."
    
    cd "$FRONTEND_DIR"
    
    # Start frontend in background
    npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # Wait a moment for frontend to start
    sleep 3
    
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        log_success "Frontend started successfully (PID: $FRONTEND_PID)"
    else
        log_error "Failed to start frontend"
        exit 1
    fi
}

# Display service information
display_service_info() {
    echo ""
    log_success "PolyStat Dashboard is starting up!"
    echo ""
    echo "📊 Available Services:"
    echo "  • Frontend React: http://localhost:$FRONTEND_PORT"
    echo "  • Backend API: http://localhost:$BACKEND_PORT"
    echo "  • API Documentation: http://localhost:$BACKEND_PORT/docs"
    echo ""
    echo "📝 Logs:"
    echo "  • Backend: ${BACKEND_DIR}/backend.log"
    echo "  • Frontend: ${FRONTEND_DIR}/frontend.log"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""
}

# Main execution
main() {
    echo "🚀 Starting PolyStat Dashboard in development mode..."
    echo ""
    
    check_dependencies
    validate_project_structure
    check_ports
    setup_backend
    setup_frontend
    start_backend
    start_frontend
    display_service_info
    
    # Wait for processes to complete
    wait
}

# Run main function
main "$@"
