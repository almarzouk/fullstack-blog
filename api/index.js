const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Post = require("./models/Post");
const multer = require("multer");
const uploadMiddleWare = multer({ dest: "uploads/" });
const fs = require("fs");
const SECRET_TOKEN = "itsmysecrenttokeddon983u1!@#!@#%^%$^%$34nij2123";
app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
mongoose.connect(
  "mongodb+srv://jumaa:jumaa@myblog.jancr27.mongodb.net/myblog?retryWrites=true&w=majority"
);
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  try {
    const user = await User.create({
      username,
      password: hashedPassword,
    });
    res.json({ user });
  } catch (e) {
    res.status(400).json({ e });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ message: "Please add all fields" });
  }
  const user = await User.findOne({ username });
  const passOk = await bcrypt.compare(password, user.password);
  if (!passOk) {
    res.status(400).json({ message: "Password is incorrect" });
  }
  if (user && passOk) {
    jwt.sign({ username, id: user._id }, SECRET_TOKEN, {}, (err, token) => {
      if (err) {
        res.status(400).json({ message: err.message });
      }
      res.cookie("token", token).json({
        id: user._id,
        username,
      });
    });
  } else {
    res.status(400).json({ message: "Worng credentials" });
  }
});
app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, SECRET_TOKEN, {}, (err, info) => {
    if (err) {
      res.status(400).json({ err });
    } else {
      res.json(info);
    }
  });
});
app.post("/logout", (req, res) => {
  res.cookie("token", "").json("ok");
});

app.post("/post", uploadMiddleWare.single("file"), async (req, res) => {
  // Upload cover image
  const { originalname, path } = req.file;
  const parts = originalname.split(".");
  const ext = parts[parts.length - 1];
  const newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  // create the post
  const { token } = req.cookies;
  jwt.verify(token, SECRET_TOKEN, {}, async (err, info) => {
    if (err) {
      res.status(400).json({ err });
    } else {
      const { title, summary, content } = req.body;
      const post = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(post);
    }
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  const { id } = req.params;
  const post = await Post.findById(id).populate("author", ["username"]);
  res.json(post);
});
app.put("/post", uploadMiddleWare.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  // create the post
  const { token } = req.cookies;
  jwt.verify(token, SECRET_TOKEN, {}, async (err, info) => {
    if (err) {
      res.status(400).json({ err });
    } else {
      const { id, title, summary, content } = req.body;
      const post = await Post.findById(id);
      const isAuthor = JSON.stringify(post.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json({ message: "You are not authorized" });
      }
      await post.updateOne({
        title,
        summary,
        content,
        cover: newPath ? newPath : post.cover,
      });
      res.json(post);
    }
  });
});
app.listen(4000);
