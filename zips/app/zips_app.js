require('dotenv').config();
const express = require('express');
const body_parser = require('body-parser');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
const url = process.env.MONGODB_URI;
const client = new MongoClient(url);

let collection;

app.set('view engine', 'ejs');
app.engine('js', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));
app.use(body_parser.urlencoded({ extended: true }));

async function connect_to_db() {
    await client.connect();
    const db = client.db();
    collection = db.collection('places');
    console.log('connected to mongodb!');
}

app.get('/', (req, res) => {
    res.render('home.ejs');
});

app.post('/process', async (req, res) => {
    const query = req.body.query.trim();
    let result;

    // use a regular expression to check if the input is full numbers to treat it like a zip
    if (/^\d+$/.test(query)) {
        result = await collection.findOne({ zips: query });
    // if it consists of full letters then we treat it as a place
    } else if (/^[a-zA-Z\s]+$/.test(query)) { 
        result = await collection.findOne({ place: query });
    } else {
    // don't even check the collection otherwise bc not a valid query
        result = null;
    }

    res.render('result', { query, result });
});

app.listen(3000, () => {
    console.log('server is running on port 3000');
    connect_to_db().catch(console.error);
});