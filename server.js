const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const secretKey = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mydatabase';
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define the user schema and model
const userSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone_number: { type: String, required: true },
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

// Define the profile schema and model
const profileSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    education: { type: String, required: true },
    degree: { type: String, required: true },
    experience: { type: String, required: true },
    address: { type: String, required: true },
    githubLink: { type: String, required: true }
});

const Profile = mongoose.model('Profile', profileSchema);

// Define a schema and model for GitHub links
const githubSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    githubLink: { type: String }
});

const GitHubUser = mongoose.model('GitHubUser', githubSchema);

// Define the job schema and model
const jobSchema = new mongoose.Schema({
    jobName: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, required: true },
    mail: { type: String, required: true }
});

const Job = mongoose.model('Job', jobSchema);

// Root route
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

// Signup route
app.post('/signup', async(req, res) => {
    const { full_name, email, phone_number, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ full_name, email, phone_number, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id }, secretKey, { expiresIn: '1h' });

        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        console.error('Error during signup:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login route
app.post('/login', async(req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user._id }, secretKey, { expiresIn: '1h' });

        res.status(200).json({ message: 'Login successful', token, email });
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Middleware to verify JWT token
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        console.log('No token provided');
        return res.status(401).json({ message: 'No token provided' });
    }

    const tokenParts = token.split(' ');
    if (tokenParts[0] !== 'Bearer' || !tokenParts[1]) {
        console.log('Invalid token format');
        return res.status(401).json({ message: 'Invalid token format' });
    }

    jwt.verify(tokenParts[1], secretKey, (err, decoded) => {
        if (err) {
            console.log('Failed to authenticate token:', err.message);
            return res.status(401).json({ message: 'Failed to authenticate token' });
        }

        req.userId = decoded.id;
        next();
    });
}

// Profile management routes
app.post('/api/profile', verifyToken, async(req, res) => {
    try {
        const { email, education, degree, experience, address, githubLink } = req.body;

        let profile = await Profile.findOne({ email });
        if (profile) {
            profile.education = education;
            profile.degree = degree;
            profile.experience = experience;
            profile.address = address;
            profile.githubLink = githubLink;
            await profile.save();
            return res.json(profile);
        } else {
            profile = new Profile({ email, education, degree, experience, address, githubLink });
            await profile.save();
            return res.json(profile);
        }
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

app.get('/api/profile', verifyToken, async(req, res) => {
    try {
        const user = await User.findById(req.userId);
        const profile = await Profile.findOne({ email: user.email });

        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        res.json(profile);
    } catch (err) {
        console.error('Error fetching profile:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});
// Add this route to fetch all profiles
app.get('/api/profiles', verifyToken, async(req, res) => {
    try {
        const profiles = await Profile.find();
        res.json(profiles);
    } catch (err) {
        console.error('Error fetching profiles:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});


app.get('/api/profile/:email', async(req, res) => {
    try {
        const email = req.params.email;
        const profile = await Profile.findOne({ email });

        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }

        res.json(profile);
    } catch (err) {
        console.error('Error fetching profile:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

// GitHub link routes
app.post('/github', async(req, res) => {
    const { email, githubLink } = req.body;

    try {
        let githubUser = await GitHubUser.findOne({ email });

        if (!githubUser) {
            githubUser = new GitHubUser({ email, githubLink });
            await githubUser.save();
        } else {
            githubUser.githubLink = githubLink;
            await githubUser.save();
        }

        res.redirect(`/saved.html?email=${encodeURIComponent(email)}`);
    } catch (err) {
        console.error('Error saving GitHub link:', err.message);
        res.status(500).send('Error saving the GitHub link.');
    }
});

// Job management routes
app.post('/api/jobs', (req, res) => {
    const { jobName, companyName, location, mail } = req.body;

    const newJob = new Job({ jobName, companyName, location, mail });
    newJob.save()
        .then(() => res.json({ success: true }))
        .catch(err => res.json({ success: false, error: err.message }));
});

app.get('/api/jobs', async(req, res) => {
    try {
        const jobs = await Job.find();
        res.json(jobs);
    } catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// Serve profile.html and saved.html
app.get('/profile.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/saved.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'saved.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));