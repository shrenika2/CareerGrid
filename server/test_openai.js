const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const testOpenAI = async () => {
    try {
        console.log('Testing OpenAI API Key:');
        console.log(process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'No API key found');
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{role: 'user', content: 'hello'}]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });
        console.log('Success!', response.data.choices[0].message);
    } catch (err) {
        console.error('Failed:', err.response ? err.response.data : err.message);
    }
};

testOpenAI();
