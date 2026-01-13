// Vercel Serverless Function Handler
// This wraps the Express app for Vercel's serverless environment

let app;

export default async (req, res) => {
  try {
    // Lazy load the app on first request
    if (!app) {
      console.log('Loading Express app...');
      const module = await import('../server/server.js');
      app = module.default;
      console.log('Express app loaded successfully');
    }

    // Handle the request with Express
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    console.error('Stack:', error.stack);

    // Return error response
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

