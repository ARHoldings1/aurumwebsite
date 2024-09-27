const express = require('express');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const crypto = require('crypto');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// In-memory storage (replace with a database in production)
const users = [];
const payments = [];

function encryptData(data) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

app.post('/api/store-user-data', (req, res) => {
    const userData = req.body;
    // Here, you would typically store the data in your database
    console.log('Received user data:', userData);
    
    // For this example, we're just sending a success response
    res.status(200).json({ message: 'User data stored successfully' });
});

app.post('/create-checkout-session', async (req, res) => {
    const { amount } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Aurum Tokens',
                        },
                        unit_amount: 100, // $1.00 in cents
                    },
                    quantity: amount,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin}/#home?payment=success`,
            cancel_url: `${req.headers.origin}/#home?payment=cancelled`,
        });

        res.json({ id: session.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));