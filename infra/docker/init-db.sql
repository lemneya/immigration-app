-- Create additional databases for different services
CREATE DATABASE docuseal;
CREATE DATABASE formio_data;

-- Create users with appropriate permissions
CREATE USER docuseal_user WITH PASSWORD 'docuseal_password';
GRANT ALL PRIVILEGES ON DATABASE docuseal TO docuseal_user;

-- Grant permissions to main user
GRANT ALL PRIVILEGES ON DATABASE immigration_suite TO immigration;
GRANT ALL PRIVILEGES ON DATABASE docuseal TO immigration;
GRANT ALL PRIVILEGES ON DATABASE formio_data TO immigration;