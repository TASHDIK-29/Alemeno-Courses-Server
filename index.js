const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const bcrypt = require('bcryptjs');

const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],

}
app.use(cors(corsOptions))
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iepmiic.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const coursesCollection = client.db("Alemeno").collection("courses");
        const usersCollection = client.db("Alemeno").collection("users");



        //Register
        app.post('/register', async (req, res) => {
            const user = req.body;
            console.log('user = ', user);

            // insert email if User does not exist
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist!', insertedId: null })
            }

            const salt = await bcrypt.genSalt(10)
            const securePassword = await bcrypt.hash(req.body.password, salt)

            const userInfo = {
                
                ...user,
                password: securePassword,
                enrolled: 0,
            }
            const result = await usersCollection.insertOne(userInfo);

            res.send(result);
        })






        app.get('/allCourse', async (req, res) => {
            const { search } = req.query;

            let filter = {};
            if (search) {
                filter = {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { instructor: { $regex: search, $options: 'i' } }
                    ]
                };
            }

            const courses = await coursesCollection.find(filter).toArray();

            res.send(courses);
        })

        app.get('/courses/:id', async (req, res) => {
            const id = req.params.id;

            const courseDetail = await coursesCollection.findOne({ _id: new ObjectId(id) });

            res.send(courseDetail);
        })







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Alemeno is On');
})

app.listen(port, () => {
    console.log(`Alemeno is on port ${port}`);
})