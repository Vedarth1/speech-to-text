const FormData = require('form-data');
const { Readable } = require('stream');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmetadata = require('ffmetadata');
const fs = require('fs');
require('dotenv').config();

const parseTimeStringToSeconds = timeString => {
    const [minutes, seconds] = timeString.split(':').map(tm => parseInt(tm));
    return minutes * 60 + seconds;
}

const audioFile = "audio3.mp3";
const startTime = "00:00";
const endTime = "00:12";
const startSeconds = parseTimeStringToSeconds(startTime);
const endSeconds = parseTimeStringToSeconds(endTime);
const timeDuration = endSeconds - startSeconds;
const bufferToStream = (filePath) => {
    const fileBuffer = fs.readFileSync(filePath);
    const stream = Readable.from(fileBuffer);
    return stream;
};

if (!audioFile) {
    console.log("file nhi he");
}
const audioStream = bufferToStream(audioFile);

const trimAudio = (audioStream, endTime) => {
    const tempFileName = `temp-${Date.now()}.mp3`;
    const outputFileName = `output-${Date.now()}.mp3`;

    return new Promise((resolve, reject) => {
        audioStream.pipe(fs.createWriteStream(tempFileName))
            .on('finish', () => {
                ffmetadata.read(tempFileName, (err, metadata) => {
                    if (err) reject(err);
                    const duration = parseFloat(metadata.duration);
                    if (endTime > duration) endTime = duration;

                    ffmpeg(tempFileName)
                        .setStartTime(startSeconds)
                        .setDuration(timeDuration)
                        .output(outputFileName)
                        .on('end', () => {
                            fs.unlink(tempFileName, (err) => {
                                if (err) console.error('Error deleting temp file:', err);
                            });

                            const trimmedAudioBuffer = fs.readFileSync(outputFileName);
                            fs.unlink(outputFileName, (err) => {
                                if (err) console.error('Error deleting output file:', err);
                            });

                            resolve(trimmedAudioBuffer);
                        })
                        .on('error', reject)
                        .run();
                });
            })
            .on('error', reject);
    });
};
const formData = new FormData();
const processAudio = async () => {
    try {
        const trimmedAudioStream = await trimAudio(audioStream, endTime);

        formData.append('file', trimmedAudioStream, { filename: 'audio.mp3', contentType: "audio/mp3" });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        return formData;
    } catch (error) {
        return res.status(400).json({ error: 'error in processing audio' });
    }
};


const xyz = async (formData) => {
    try {
        const config = {
            headers: {
                "Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        };
        return config;
    }
    catch (error) {
        return res.status(400).json({ error: 'error in configuration audio' });
    }
}

(async () => {
    try {
        const formData = await processAudio();
        const config = await xyz(formData);
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, config);
        const transcription = response.data.text;
        console.log(transcription);

    } catch (error) {
        console.log({ error: error.message });
    }
})();



