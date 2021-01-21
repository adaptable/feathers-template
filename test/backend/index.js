const express = require('express');
const moviedb = require('./moviedb');

let port = Number(process.env.PORT);
if (isNaN(port)) port = 80;

const app = express();
app.use(express.json());

/*
 * Movie API
 */
app.get('/search/:query', (req, res) => {
    moviedb.find(req.params.query)
        .then(rows => res.json(rows.map(r => ({
            title: r.title,
            released: new Date(r.released).toDateString()
        }))))
        .catch(err => res.status(404).end("API server error" + err));
});

const svr = app.listen(port, () => console.log("Backend started on port", port));

// Graceful shutdown
process.on('SIGTERM', () => svr.close());

