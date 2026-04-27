const express = require('express');
const app = express();

// serve static files from 'public' folder
app.use(express.static('public'));

app.get('/', (req, res) => {
	res.sendFile(__dirname + '/views/index.html')
})

app.get('/yuu-prefill', (req, res) => {
	res.sendFile(__dirname + '/views/yuu-prefill.html')
})

app.listen(3000, () => console.log('running on port 3000'));