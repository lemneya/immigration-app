// MongoDB initialization script for Bmore Immigration Suite

// Create application database
db = db.getSiblingDB('immigration_suite');

// Create collections with proper indexes
db.createCollection('users');
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "isActive": 1 });

db.createCollection('audit_logs');
db.audit_logs.createIndex({ "timestamp": -1 });
db.audit_logs.createIndex({ "userId": 1, "timestamp": -1 });
db.audit_logs.createIndex({ "action": 1, "timestamp": -1 });
db.audit_logs.createIndex({ "severity": 1, "timestamp": -1 });
db.audit_logs.createIndex({ "success": 1, "timestamp": -1 });

db.createCollection('security_incidents');
db.security_incidents.createIndex({ "timestamp": -1 });
db.security_incidents.createIndex({ "type": 1, "timestamp": -1 });
db.security_incidents.createIndex({ "severity": 1, "timestamp": -1 });
db.security_incidents.createIndex({ "resolved": 1, "timestamp": -1 });

db.createCollection('documents');
db.documents.createIndex({ "userId": 1, "createdAt": -1 });
db.documents.createIndex({ "type": 1, "status": 1 });
db.documents.createIndex({ "status": 1, "createdAt": -1 });

db.createCollection('ocr_results');
db.ocr_results.createIndex({ "documentId": 1 });
db.ocr_results.createIndex({ "userId": 1, "createdAt": -1 });
db.ocr_results.createIndex({ "confidence": 1 });

db.createCollection('pdf_forms');
db.pdf_forms.createIndex({ "userId": 1, "createdAt": -1 });
db.pdf_forms.createIndex({ "formType": 1, "status": 1 });
db.pdf_forms.createIndex({ "status": 1, "createdAt": -1 });

db.createCollection('esignatures');
db.esignatures.createIndex({ "userId": 1, "createdAt": -1 });
db.esignatures.createIndex({ "documentId": 1 });
db.esignatures.createIndex({ "status": 1, "createdAt": -1 });
db.esignatures.createIndex({ "expiresAt": 1 });

db.createCollection('case_statuses');
db.case_statuses.createIndex({ "userId": 1, "caseNumber": 1 }, { unique: true });
db.case_statuses.createIndex({ "caseNumber": 1 });
db.case_statuses.createIndex({ "status": 1, "lastUpdated": -1 });
db.case_statuses.createIndex({ "lastUpdated": -1 });

db.createCollection('voice_sessions');
db.voice_sessions.createIndex({ "userId": 1, "createdAt": -1 });
db.voice_sessions.createIndex({ "sessionId": 1 }, { unique: true });
db.voice_sessions.createIndex({ "status": 1, "createdAt": -1 });

// Create TTL indexes for temporary data
db.audit_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000 }); // 90 days
db.voice_sessions.createIndex({ "createdAt": 1 }, { expireAfterSeconds: 86400 }); // 1 day for inactive sessions

// Insert initial admin user (password: admin123!)
db.users.insertOne({
  email: "admin@immigration-suite.gov",
  hashedPassword: "$2a$12$rQk7P2fvL7qJ8vLzM9/3v.LtqB5K8wLyH5uO9z3hU8vF9eF7wKvCG", // admin123!
  role: "admin",
  permissions: [
    "users:read", "users:write", "users:delete",
    "ocr:process", "ocr:read",
    "pdf:fill", "pdf:read",
    "esign:create", "esign:read", "esign:sign",
    "case-status:read", "case-status:track",
    "voice:translate", "voice:session:manage",
    "admin:dashboard", "admin:logs", "admin:system",
    "security:read", "security:write", "security:incidents"
  ],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// Create development database for testing
db = db.getSiblingDB('immigration_suite_dev');

// Copy structure to dev database
db.createCollection('users');
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "isActive": 1 });

db.createCollection('audit_logs');
db.audit_logs.createIndex({ "timestamp": -1 });
db.audit_logs.createIndex({ "userId": 1, "timestamp": -1 });

db.createCollection('documents');
db.documents.createIndex({ "userId": 1, "createdAt": -1 });

db.createCollection('ocr_results');
db.ocr_results.createIndex({ "documentId": 1 });

db.createCollection('pdf_forms');
db.pdf_forms.createIndex({ "userId": 1, "createdAt": -1 });

db.createCollection('esignatures');
db.esignatures.createIndex({ "userId": 1, "createdAt": -1 });

db.createCollection('case_statuses');
db.case_statuses.createIndex({ "userId": 1, "caseNumber": 1 }, { unique: true });

db.createCollection('voice_sessions');
db.voice_sessions.createIndex({ "userId": 1, "createdAt": -1 });

// Insert dev admin user
db.users.insertOne({
  email: "admin@immigration-suite.gov",
  hashedPassword: "$2a$12$rQk7P2fvL7qJ8vLzM9/3v.LtqB5K8wLyH5uO9z3hU8vF9eF7wKvCG", // admin123!
  role: "admin",
  permissions: [
    "users:read", "users:write", "users:delete",
    "ocr:process", "ocr:read",
    "pdf:fill", "pdf:read",
    "esign:create", "esign:read", "esign:sign",
    "case-status:read", "case-status:track",
    "voice:translate", "voice:session:manage",
    "admin:dashboard", "admin:logs", "admin:system",
    "security:read", "security:write", "security:incidents"
  ],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Bmore Immigration Suite database initialized successfully');