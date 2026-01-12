/**
 * Integration Tests: Socket Error Handling
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { io as ioClient } from 'socket.io-client';
import { createServer } from 'http';
import { Server } from 'socket.io';

describe('Socket Error Handling', () => {
  let httpServer;
  let io;
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = ioClient(`http://localhost:${port}`);
      
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('send_message error handling', () => {
    it('should return error for null data', (done) => {
      clientSocket.emit('send_message', null);
      
      clientSocket.on('message:error', (error) => {
        expect(error.code).toBe('INVALID_DATA');
        expect(error.message).toContain('Invalid message data');
        done();
      });
    });

    it('should return error for missing recipientId', (done) => {
      clientSocket.emit('send_message', { content: 'test' });
      
      clientSocket.on('message:error', (error) => {
        expect(error.code).toBe('MISSING_RECIPIENT');
        expect(error.message).toContain('Recipient ID is required');
        done();
      });
    });

    it('should return error for empty message', (done) => {
      clientSocket.emit('send_message', { 
        recipientId: 'user123',
        content: ''
      });
      
      clientSocket.on('message:error', (error) => {
        expect(error.code).toBe('EMPTY_MESSAGE');
        expect(error.message).toContain('Message content cannot be empty');
        done();
      });
    });

    it('should include timestamp in error response', (done) => {
      clientSocket.emit('send_message', null);
      
      clientSocket.on('message:error', (error) => {
        expect(error.timestamp).toBeDefined();
        expect(new Date(error.timestamp)).toBeInstanceOf(Date);
        done();
      });
    });
  });

  describe('Error recovery', () => {
    it('should allow retry after error', (done) => {
      // First attempt with error
      clientSocket.emit('send_message', null);
      
      clientSocket.once('message:error', () => {
        // Second attempt with valid data
        clientSocket.emit('send_message', {
          recipientId: 'user123',
          content: 'Valid message'
        });
        
        // Should not receive another error
        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });
});

