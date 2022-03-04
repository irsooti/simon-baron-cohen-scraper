const https = require('https');
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');
const { v4 } = require('uuid');

const downloadImage = (url, destination) =>
  new Promise((resolve, reject) => {
    const dir = path.resolve(__dirname, 'assets', 'images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(path.resolve(__dirname, dir));
    }
    const file = fs.createWriteStream(path.resolve(dir, destination));

    https
      .get(url, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close(resolve(true));
        });
      })
      .on('error', (error) => {
        fs.unlink(destination);

        reject(error.message);
      });
  });

(async () => {
  const browser = await puppeteer.launch({ dumpio: true });
  const page = await browser.newPage();
  await page.goto(
    'https://s3.amazonaws.com/he-assets-prod/interactives/233_reading_the_mind_through_eyes/Launch.html'
  );

  await page.evaluate(async () => {
    document.querySelector('.begin-button').click();
  });

  await page.waitForSelector('.question-button');

  try {
    const all = await page.evaluate(async () => {
      const all = [];
      let index = 0;

      const getAnswers = () => {
        const answers = [];
        document.querySelector('.question-button').click();
        document
          .querySelectorAll('.question-button')
          .forEach((questionElement) => {
            answers.push({
              answer: questionElement.textContent,
              isCorrect: questionElement.classList.contains('mark-correct'),
            });
          });

        return answers;
      };

      const getQuestion = (id) => {
        const imageUrl = window
          .getComputedStyle(document.querySelector('.question-image'))
          .backgroundImage.split('"')[1];

        return imageUrl;
      };

      const isNotEnded = () => {
        console.log(
          window.getComputedStyle(
            document.querySelector('.last-question-visible')
          ).visibility
        );
        return (
          window.getComputedStyle(
            document.querySelector('.last-question-visible')
          ).display === 'none'
        );
      };

      while (isNotEnded()) {
        const image = await getQuestion(index);

        all.push({
          image: image,
          answers: getAnswers(),
        });

        document.querySelector('.continue-button').click();
        index++;
      }

      return all;
    });

    const data = all.map(({ image, answers }) => {
      const id = v4();
      downloadImage(image, `${id}.jpg`);

      return {
        id,
        answers,
      };
    });

    const dir = path.resolve(__dirname, 'assets');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(path.resolve(__dirname, dir));
    }

    fs.writeFileSync(
      path.resolve(dir, 'questions.json'),
      JSON.stringify(data, null, 4),
      { encoding: 'utf-8' }
    );
  } catch (err) {
    console.error(err);
    await browser.close();
  }

  await browser.close();
})();
