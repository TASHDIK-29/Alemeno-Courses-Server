const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        const ordersCollection = client.db("Alemeno").collection("orders");



        //Register
        app.post('/register', async (req, res) => {
            const user = req.body;
            // console.log('user = ', user);

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


        //Login
        app.post('/login', async (req, res) => {
            const { email, password } = req.body;

            const query = {
                email: email
            };

            const user = await usersCollection.findOne(query);


            if (user) {
                const isPasswordValid = await bcrypt.compare(password, user.password);
                if (isPasswordValid) {
                    console.log('User exists:', user);

                    const token = jwt.sign({ email: user.email }, 'SECRET_KEY', { expiresIn: '1h' });
                    return res.json({ token, user: { ...user, password: '' }, password: true });


                    // return res.send({ user: true, pin: true, type: user.type });
                } else {
                    console.log('Invalid pass');
                    return res.send({ user: true, password: false });
                }
            } else {
                console.log('User does not exist');
                return res.send({ user: false });
            }

        })


        // GET USER
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;

            const user = await usersCollection.findOne({ email });

            res.send(user);
        })

        // Update Profile Image
        app.put('/users/image/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };

            const newImage = req.body;
            console.log(newImage);

            const updatedDoc = {
                $set: {
                    image: newImage.imageURL
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc, { upsert: true });

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



        // Enroll Courses
        app.put('/enroll', async (req, res) => {
            const { email, id } = req.body;

            const order = await ordersCollection.findOne({
                userEmail: email,
                'orderedCourses.courseId': id
            });

            if (order) {
                return res.send({ result: false });
            }

            const newCourse = {
                courseId: id,
                state: 'on-going'
            };

            const result = await ordersCollection.updateOne(
                { userEmail: email },
                { $push: { orderedCourses: newCourse } },
                { upsert: true }
            );

            res.send({ result: true });
        })

        app.get('/course/:email', async (req, res) => {
            const email = req.params.email;

            // Find the user's order document
            const order = await ordersCollection.findOne({ userEmail: email });
            if (!order) {
                console.log('No orders found for this user.');
                return res.send([]);
            }

            // Use the course IDs to find the courses
            // const productIds = order.orderedProducts.map(op => new ObjectId(op.productId));
            const courseIds = order.orderedCourses.map(i => new ObjectId(i.courseId));
            const courses = await coursesCollection.find({ _id: { $in: courseIds } }).toArray();

            // Combine product details with their respective state
            const orderedCoursesWithDetails = order.orderedCourses.map(i => {
                const course = courses.find(c => c._id.toString() === i.courseId);
                return {
                    ...course,
                    state: i.state
                };
            });

            return res.send(orderedCoursesWithDetails);
        })


        // Complete Course
        app.patch('/courseComplete', async (req, res) => {
            const { email, id } = req.body;
            

            // Update the state of the specific product within the user's order
            const result = await ordersCollection.updateOne(
                { userEmail: email, 'orderedCourses.courseId': id.toString() },
                { $set: { 'orderedCourses.$.state': 'completed' } }
            );

            res.send(result)
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