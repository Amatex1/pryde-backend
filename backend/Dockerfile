# Use Node 18 Alpine for small image size
FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy project files
COPY . .

# Create uploads directories
RUN mkdir -p backend/uploads/profile-pictures backend/uploads/messages

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "backend/server.js"]
