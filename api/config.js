// Vercel serverless function: exposes the PUBLIC Supabase config to the browser.
// SUPABASE_ANON_KEY is safe to expose (Row Level Security protects the data);
// never add the service role key here.
module.exports = (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    });
};
