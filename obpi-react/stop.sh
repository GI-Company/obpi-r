#!/bin/bash

FRONTEND_PID_FILE=".frontend.pid"
BACKEND_PID_FILE=".backend.pid"
BACKEND_LOG_FILE="backend.log"
FRONTEND_LOG_FILE="frontend.log"
BACKEND_DIR="obpi_cde_backend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}--- Stopping OBPI OS Development Servers ---${NC}"

# Stop Frontend Server
if [ -f "$FRONTEND_PID_FILE" ]; then
    FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
    if ps -p $FRONTEND_PID > /dev/null 2>&1; then
        echo "   - Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
    else
        echo "   - Frontend server (PID: $FRONTEND_PID from stale pidfile) not running."
    fi
    rm "$FRONTEND_PID_FILE"
else
    echo "   - No frontend server PID file found. It might already be stopped."
fi

# Stop Backend Server
if [ -f "$BACKEND_PID_FILE" ]; then
    BACKEND_PID=$(cat "$BACKEND_PID_FILE")
    if ps -p $BACKEND_PID > /dev/null 2>&1; then
        echo "   - Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
    else
        echo "   - Backend server (PID: $BACKEND_PID from stale pidfile) not running."
    fi
    rm "$BACKEND_PID_FILE"
else
    echo "   - No backend server PID file found. It might already be stopped."
fi

# Cleanup log files
echo "   - Cleaning up log files..."
rm -f "$BACKEND_LOG_FILE"
rm -f "$FRONTEND_LOG_FILE"

# Optional: Clean up backend build artifacts and database
read -p "Do you want to clean the backend project directory? (This will require a full setup on next start) [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   - Removing backend project directory..."
    if [ -d "$BACKEND_DIR" ]; then
        rm -rf "$BACKEND_DIR"
        echo "     - Backend directory removed."
    else
        echo "     - Backend directory not found."
    fi
fi


echo -e "\n${GREEN}--- All services stopped. ---${NC}"
