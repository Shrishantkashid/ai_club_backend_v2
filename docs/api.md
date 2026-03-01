# AI Club Portal Backend API Documentation

## Overview

The backend is built with Node.js and Express, providing a simple API for the frontend to interact with.

## Base URL

```
http://localhost:5000
```

## Endpoints

### Health Check

#### GET `/api/health`

Check the status of the backend server.

**Response:**

```json
{
  "status": "Backend is running"
}
```

**Headers:**

- `Content-Type`: `application/json`
- CORS headers enabled for cross-origin requests

## Configuration

### Server Settings

- Port: 5000
- Middleware: CORS, JSON parsing
- Static file serving: Not enabled (API only)

### Dependencies

- Express: Web framework
- CORS: Cross-origin resource sharing
- Other standard Node.js modules

## Running the Server

```bash
node server.js
```

The server will start on port 5000 and listen for incoming requests.
