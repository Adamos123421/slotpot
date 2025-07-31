#!/bin/bash

# Cloudflare Tunnel Monitor Script
# This script monitors the cloudflare tunnel and restarts it if it goes down

TUNNEL_NAME="your-tunnel-name"  # Replace with your actual tunnel name
CONFIG_FILE="./cloudflared.yml"  # Path to your tunnel config
LOG_FILE="./tunnel-monitor.log"
PID_FILE="./tunnel.pid"
CHECK_INTERVAL=30  # Check every 30 seconds

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to check if tunnel is running
is_tunnel_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0  # Running
        else
            rm -f "$PID_FILE"
            return 1  # Not running
        fi
    else
        return 1  # Not running
    fi
}

# Function to start tunnel
start_tunnel() {
    log_message "Starting Cloudflare tunnel..."
    
    # Kill any existing cloudflared processes
    pkill -f "cloudflared tunnel"
    sleep 2
    
    # Start new tunnel process in background
    nohup cloudflared tunnel --config "$CONFIG_FILE" run "$TUNNEL_NAME" > tunnel-output.log 2>&1 &
    TUNNEL_PID=$!
    
    echo "$TUNNEL_PID" > "$PID_FILE"
    log_message "Tunnel started with PID: $TUNNEL_PID"
    
    # Wait a bit and check if it's actually running
    sleep 5
    if is_tunnel_running; then
        log_message "Tunnel successfully started and running"
        return 0
    else
        log_message "Failed to start tunnel"
        return 1
    fi
}

# Function to stop tunnel
stop_tunnel() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        log_message "Stopping tunnel with PID: $PID"
        kill "$PID" 2>/dev/null
        rm -f "$PID_FILE"
        sleep 2
    fi
    
    # Force kill any remaining cloudflared processes
    pkill -f "cloudflared tunnel"
}

# Function to check tunnel health
check_tunnel_health() {
    # Check if process is running
    if ! is_tunnel_running; then
        return 1
    fi
    
    # Optional: Add HTTP health check to your service
    # if command -v curl > /dev/null; then
    #     if ! curl -s -f "https://your-domain.com/ping" > /dev/null; then
    #         log_message "Tunnel process running but service not accessible"
    #         return 1
    #     fi
    # fi
    
    return 0
}

# Main monitoring loop
monitor_tunnel() {
    log_message "Starting tunnel monitoring (checking every ${CHECK_INTERVAL}s)"
    
    while true; do
        if check_tunnel_health; then
            echo -n "."  # Silent operation indicator
        else
            log_message "Tunnel is down, attempting restart..."
            stop_tunnel
            sleep 5
            
            if start_tunnel; then
                log_message "Tunnel restart successful"
            else
                log_message "Tunnel restart failed, will retry in ${CHECK_INTERVAL}s"
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Handle script termination
cleanup() {
    log_message "Monitor script terminated, stopping tunnel..."
    stop_tunnel
    exit 0
}

trap cleanup SIGTERM SIGINT

# Main script logic
case "${1:-monitor}" in
    start)
        start_tunnel
        ;;
    stop)
        stop_tunnel
        ;;
    restart)
        stop_tunnel
        start_tunnel
        ;;
    status)
        if is_tunnel_running; then
            PID=$(cat "$PID_FILE")
            log_message "Tunnel is running with PID: $PID"
        else
            log_message "Tunnel is not running"
        fi
        ;;
    monitor)
        monitor_tunnel
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|monitor}"
        echo "  start   - Start the tunnel"
        echo "  stop    - Stop the tunnel"
        echo "  restart - Restart the tunnel"
        echo "  status  - Check tunnel status"
        echo "  monitor - Start monitoring (default)"
        exit 1
        ;;
esac 