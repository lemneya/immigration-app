# Integration APIs Service

## Overview
The Integration APIs Service provides connectivity to external databases and third-party services, enabling data synchronization and integration with existing immigration law practice management systems.

## Features
- **Database Connectivity**: Connect to MySQL, MongoDB, Oracle, SQL Server
- **API Integration**: RESTful and SOAP API integrations
- **Data Synchronization**: Real-time and batch data sync
- **File Transfer**: FTP/SFTP file exchange
- **Data Transformation**: CSV, XML, JSON data processing
- **Scheduled Jobs**: Automated data import/export
- **Error Handling**: Comprehensive error tracking and recovery
- **Security**: Encrypted connections and secure data handling

## API Endpoints
- `POST /api/connections/test` - Test database connection
- `POST /api/sync/start` - Start data synchronization
- `GET /api/sync/status` - Get sync status
- `POST /api/import/csv` - Import CSV data
- `POST /api/export/data` - Export data to external system

## Supported Integrations
- **Legal Software**: Clio, MyCase, PracticePanther
- **Document Management**: NetDocuments, iManage
- **Government APIs**: USCIS, Department of State
- **Databases**: MySQL, PostgreSQL, MongoDB, Oracle, SQL Server

## Environment Variables
```
PORT=3017
DATABASE_URL=your_primary_db_url
MYSQL_HOST=external_mysql_host
MONGODB_URI=external_mongodb_uri
ORACLE_CONNECTION=oracle_connection_string
FTP_HOST=your_ftp_host
SFTP_HOST=your_sftp_host
```

## Getting Started
1. Install dependencies: `pnpm install`
2. Set up environment variables
3. Configure external connections
4. Start development: `pnpm dev`

## Technologies
- Multiple database drivers
- SOAP and REST client libraries
- FTP/SFTP clients
- CSV/XML parsing libraries
- Cron job scheduling
