# Analytics Service

## Overview
The Analytics Service provides comprehensive insights into client metrics, case tracking, and system performance for the Immigration Suite platform.

## Features
- **Case Analytics**: Track case progress and completion rates
- **Client Metrics**: User engagement and satisfaction analytics
- **Performance Monitoring**: System performance and usage statistics
- **Custom Reports**: Generate detailed analytical reports
- **Data Visualization**: Charts and graphs for data insights
- **Real-Time Dashboards**: Live analytics dashboards
- **Export Capabilities**: Export reports in various formats

## API Endpoints
- `GET /api/analytics/cases` - Get case analytics
- `GET /api/analytics/clients` - Get client metrics
- `GET /api/analytics/performance` - Get performance metrics
- `POST /api/reports/generate` - Generate custom report
- `GET /api/dashboards/:type` - Get dashboard data

## Environment Variables
```
PORT=3015
DATABASE_URL=your_database_url
INFLUXDB_URL=your_influxdb_url
REDIS_URL=your_redis_url
```

## Getting Started
1. Install dependencies: `pnpm install`
2. Set up environment variables
3. Start development: `pnpm dev`

## Technologies
- Express.js and TypeScript
- InfluxDB for time-series data
- Chart.js for visualizations
- Redis for caching
