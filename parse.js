'use strict';
const snoowrap = require('snoowrap');
const fs = require('fs');
const {user, pass, client, secret} = require('./Credentials')

// NOTE: The following examples illustrate how to use snoowrap. However, hardcoding
// credentials directly into your source code is generally a bad idea IN practice (especially
// if you're also making your source code public). Instead, it's better to either (a) use a separate
// config file that isn't committed into version control, or (b) use environment variables.
// Create a new snoowrap requester with OAuth credentials. 
// For more information on getting credentials, see here: https://github.com/not-an-aardvark/reddit-oauth-helper

const r = new snoowrap({
  userAgent: 'Simple parser by u/Gonca007',
  clientId: client,
  clientSecret: secret,
  username: user,
  password: pass
});

const getComments = async (linkID) => {
  return new Promise((resolve, reject) => {
    let info = {
      id: linkID,
      comments: []
    };

    r.getSubmission(info.id).expandReplies({
      limit: Infinity,
      depth: Infinity
    }).then(thread => {
      thread.comments.forEach((comment) => {
        processComment(comment, info.comments);
      })
      resolve(info);
    });
  });
}
const getPost = async (linkID) => {
  return new Promise((resolve, reject) => {
    let info = {
      id: linkID
    };
    const redditSite = /www\.reddit\.com/;
    r.getSubmission(info.id).fetch().then(thread => {
      info.title = thread.title;
      info.author = thread.author.name;
      info.channel = thread.subreddit.display_name;
      info.date = thread.created;
      info.body = thread.selftext;
      info.body_html = thread.selftext_html;
      info.score = thread.score;
      info.link = redditSite.test(thread.url) ? '' : thread.url;
      info.parent = '';
      info.image = (thread.preview) ? thread.preview.images[0].source.url : ''
      resolve(info);
    });
  });
}

async function getAll(id) {
  const comments = await getComments(id);
  const res = await getPost(id);
  const streamComments = fs.createWriteStream(`./out/${comments.id}_comments.sql`, {
    flags: "w"
  });
  comments.comments.forEach(comment => {
    writeStory(streamComments, comment);
  });
  const streamStory = fs.createWriteStream(`./out/stories.sql`, {
    flags: "a"
  });
  writeStory(streamStory, res);
}

function writeStory(streamComments, c) {
  streamComments.write(`INSERT INTO Story (story_id, user_id, content, link, image, channel, story_points, date, title, parent_story) VALUES ('${c.id}', '${c.author}', '${c.body}', '${c.link}', '${c.image}', '${c.channel}', '${c.score}', '${c.date}', '${c.title}', '${c.parent}');\n`);
}

function processComment(comment, comments) {
  let cmt = {
    author: comment.author.name,
    body: comment.body,
    score: comment.score,
    link: '',
    channel: '',
    date: comment.created,
    title: '',
    image: ''
  };
  const id = comment.id.split('_');
  const parent = comment.parent_id.split('_');
  cmt.id = id[id.length - 1];
  cmt.parent = parent[parent.length - 1];
  comment.replies.forEach(cmo => {
    processComment(cmo, comments)
  });
  comments.push(cmt);
}
const X = async () => {
  let ids = ['a1l1ge', 'a18s0g'];
  if (process.argv.length > 2) {
    ids = process.argv.splice(2);
  }
  ids.forEach( async (id) => {await getAll(id)});

}
X();