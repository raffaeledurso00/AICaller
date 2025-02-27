### Docker Commands

#### Development Environment
```bash
# Start all services in development mode
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild and start services
docker-compose up -d --build

# View logs
docker-compose logs -f

# View logs for a specific service
docker-compose logs -f api
```

#### Production Environment
```bash
# Start all services in production mode
docker-compose -f docker-compose.prod.yml up -d

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Rebuild and start services
docker-compose -f docker-compose.prod.yml up -d --build
```