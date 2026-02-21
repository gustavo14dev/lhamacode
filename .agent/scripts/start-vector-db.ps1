# Start-VectorDB.ps1
# Starts a local Qdrant Vector Database using Docker
# Usage: ./start-vector-db.ps1

Write-Host "🚀 Starting Local Vector Database (Qdrant)..." -ForegroundColor Cyan

# Check if Docker is running
if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Pull Qdrant image
Write-Host "⬇️ Pulling qdrant/qdrant:latest..."
docker pull qdrant/qdrant:latest

# Run Qdrant container
# Ports: 6333 (API), 6334 (GRPC)
$containerName = "antigravity_qdrant"
$existing = docker ps -a -q -f name=$containerName

if ($existing) {
    Write-Host "🔄 Restarting existing container..."
    docker start $containerName
} else {
    Write-Host "🆕 Creating new container..."
    docker run -d -p 6333:6333 -p 6334:6334 `
        -v $(pwd)/.qdrant_data:/qdrant/storage `
        --name $containerName `
        qdrant/qdrant:latest
}

# Wait for health check
Write-Host "⏳ Waiting for Qdrant to be ready..."
Start-Sleep -Seconds 5

try {
    $response = Invoke-RestMethod -Uri "http://localhost:6333/healthz" -Method Get
    Write-Host "✅ Qdrant is RUNNING on http://localhost:6333" -ForegroundColor Green
    Write-Host "📊 Dashboard available at http://localhost:6333/dashboard" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Qdrant started but health check failed. Check docker logs." -ForegroundColor Yellow
}
