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

app.post('/api/store-user-data', (req, res) => {
    const userData = req.body;
    // Here, you would typically store the data in your database
    console.log('Received user data:', userData);
    
    // For this example, we're just sending a success response
    res.status(200).json({ message: 'User data stored successfully' });
});


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

app.post('/create-checkout-session', async (req, res) => {
    const { name, email, phone, cardType } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Aurum Token',
                        },
                        unit_amount: 100, // $1.00 in cents
                    },
                    quantity: 100, // Minimum purchase of 100 tokens
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/success`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel`,
            customer_email: email,
            metadata: {
                name: name,
                phone: phone,
                cardType: cardType
            }
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/process-payment', async (req, res) => {
    try {
        const {token, name, email, phone} = req.body;

        // Create a customer in Stripe
        const customer = await stripe.customers.create({
            source: token,
            name: name,
            email: email,
            phone: phone
        });

        // Create a charge (you may want to adjust the amount)
        const charge = await stripe.charges.create({
            amount: 10000, // $100.00 in cents
            currency: 'usd',
            customer: customer.id,
            description: 'Aurum Token Purchase'
        });

        // Store user data (encrypt sensitive information)
        const user = {
            name: name,
            email: email,
            phone: encryptData(phone),
            customerId: customer.id,
            createdAt: new Date()
        };
        users.push(user);

        // Store payment data (encrypt sensitive information)
        const payment = {
            customerId: customer.id,
            amount: charge.amount,
            last4: charge.payment_method_details.card.last4,
            createdAt: new Date()
        };
        payments.push(payment);

        // Schedule deletion of payment data after 24 hours
        setTimeout(() => {
            const index = payments.findIndex(p => p.customerId === customer.id);
            if (index !== -1) {
                payments.splice(index, 1);
            }
        }, 24 * 60 * 60 * 1000);

        res.json({success: true});
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({success: false, error: error.message});
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));