require('dotenv').config();
const fs = require('fs');
const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI;
const client = new MongoClient(url);

async function clear_database() {
    await client.connect();
    const db_name = client.db().databaseName;
    const collection_name = 'places';
    const db = client.db(db_name);
    const collection = db.collection(collection_name);
    await collection.deleteMany({});
    console.log('cleared database');
}

async function main() {
    await client.connect();
    console.log('connected to mongodb');
    const db_name = client.db().databaseName;
    const collection_name = 'places';
    const db = client.db(db_name);
    const collection = db.collection(collection_name);

    const places = {};

    const data = fs.readFileSync('zips.csv', 'utf8');
    const lines = data.trim().split('\n');

    for (const line of lines) {
        const [place, zip] = line.split(',').map(s => s.trim());

        if (!place || !zip) {
            console.log(`invalid line ${line}`);
            continue;
        }

        if (places[place]) {
            places[place].push(zip);
            console.log(`updated existing place [${place}] to have zip [${zip}]`);
        } else {
            places[place] = [zip];
            console.log(`added a new place [${place}] with zip [${zip}]`);
        }
    }

    const documents = Object.keys(places).map(place => ({ place, zips: places[place] }));
    await collection.insertMany(documents);
    console.log('finished!');
    await client.close();
}

async function run() {
    await clear_database();
    await main();
}

run().catch(console.error);