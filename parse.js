'use strict';
const snoowrap = require('snoowrap');
const fs = require('fs');
const {
  agent,
  user,
  pass,
  client,
  secret
} = require('./Credentials');
const {
  bios
} = require('./Bios');
const outputFolder = './out';
// NOTE: The following examples illustrate how to use snoowrap. However, hardcoding
// credentials directly into your source code is generally a bad idea IN practice (especially
// if you're also making your source code public). Instead, it's better to either (a) use a separate
// config file that isn't committed into version control, or (b) use environment variables.
// Create a new snoowrap requester with OAuth credentials. 
// For more information on getting credentials, see here: https://github.com/not-an-aardvark/reddit-oauth-helper

const email_providers = ["hotmail.com", "gmail.com", "fe.up.pt", "yahoo.com", "iol.pt", "sapo.pt"];

const r = new snoowrap({
  userAgent: agent,
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
      info.link = redditSite.test(thread.url) ? null : thread.url;
      info.parent = null;
      info.image = (thread.preview) ? thread.preview.images[0].source.url : null
      resolve(info);
    });
  });
}

async function getAll(id) {
  let users = new Set();
  let channels = new Set();
  const tempComments = await getComments(id);
  const comments = tempComments.comments.reverse();
  const res = await getPost(id);
  const streamComments = fs.createWriteStream(`./out/${tempComments.id}_comments.sql`, {
    flags: "w"
  });

  streamComments.write('PRAGMA foreign_keys = on;');

  comments.forEach(comment => {
    writeStory(streamComments, comment);
    users.add(comment.author);
  });

  
  const streamStory = fs.createWriteStream(`./out/stories.sql`, {
    flags: "a"
  });

  writeStory(streamStory, res);
  
  users.add(res.author);
  channels.add(res.channel);
  return {users, channels};
}

function writeStory(streamComments, c) {
  streamComments.write(`INSERT INTO Story (story_id, user_id, content, link, image, channel, story_points, date, title, parent_story) VALUES (${hN(c.id)}, ${hN(c.author)}, ${hN(c.body)}, ${hN(c.link)}, ${hN(c.image)}, ${hN(c.channel)}, ${hN(c.score)}, ${hN(c.date)}, ${hN(c.title)}, ${hN(c.parent)});\n`);
}

function hN(content) {
  if (content === null) {
    return 'NULL';
  } else {
    return `'${content}'`;
  }
}

function processComment(comment, comments) {
  let cmt = {
    author: comment.author.name,
    body: comment.body,
    score: comment.score,
    link: null,
    channel: null,
    date: comment.created,
    title: '',
    image: null
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

async function processUsers(users) {
  const streamUser = fs.createWriteStream(`./out/users.sql`, {
    flags: "a"
  });

  streamUser.write('PRAGMA foreign_keys = on;');

  users.forEach(user => {
    const timeNow = Math.round((new Date()).getTime() / 1000);
    r.getUser(user).fetch().then(userInfo => {
      const created = userInfo.created;
      const lastTime = Math.round((timeNow - created) * Math.random() + created);
      const password = 1234;
      const userPoints = 0;
      const email = `${user}@${email_providers[Math.floor(Math.random()*email_providers.length)]}`;
      const photo = userInfo.icon_img;
      const bio = bios[Math.floor(Math.random()*bios.length)]

      streamUser.write(`INSERT INTO User (email, username, password, last_log, account_day, user_points, profile_photo, bio) VALUES ('${email}', '${user}', '${password}', '${lastTime}', '${created}', '${userPoints}', '${photo}', '${bio}');\n`);

    });

  });
}
async function processChannels(channels) {
  const streamChannel = fs.createWriteStream(`./out/channels.sql`, {
    flags: "a"
  });
  streamChannel.write('PRAGMA foreign_keys = on;');
  channels.forEach(channel => {
    streamChannel.write(`INSERT INTO Channels (name) VALUES ('${channel}');`);
  });
}


const X = async () => {
  let ids = ['a1l1ge', 'a18s0g'];
  if (process.argv.length > 2) {
    ids = process.argv.splice(2);
  }
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
  }

  const streamStory = fs.createWriteStream(`./out/stories.sql`, {
    flags: "a"
  });

  streamStory.write('PRAGMA foreign_keys = on;');
  

  let users = new Set();
  let channels = new Set();
  const pr = await Promise.all(ids.map(async (id) => {
    const result = await getAll(id);
    const tempUsers = result.users;
    const tempChannels = result.channels;
    tempUsers.forEach(u => users.add(u));
    tempChannels.forEach(u => channels.add(u));
  }));
  processUsers(users);
  processChannels(channels);

}
X();