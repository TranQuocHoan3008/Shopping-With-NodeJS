const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { DATE } = require("sequelize");

const transporter = nodemailer.createTransport({
  host: "Smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "hoantran03082003@gmail.com",
    pass: "olxgvcxzfsnossrv",
  },
});
// authentication login
exports.getLogin = (req, res) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    isLoggedIn: false,
    errorMessage: message,
  });
};

exports.postLogin = (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  User.findOne({
    email: email,
  }).then((user) => {
    if (!user) {
      req.flash("error", "Invalid email or password.");
      return res.redirect("/login");
    }
    bcrypt
      .compare(password, user.password)
      .then((matchPassword) => {
        if (matchPassword) {
          req.session.isLoggedIn = true;
          req.session.user = user;
          return req.session.save((error) => {
            console.log(error);
            res.redirect("/");
          });
        }
        req.flash("error", "Invalid email or password.");
        res.redirect("/login");
      })
      .catch((error) => {
        console.log(error);
        res.redirect("/login");
      });
  });
};

exports.postLogout = (req, res) => {
  req.session.user = new User().init(req.session.user);
  req.session.destroy((error) => {
    res.redirect("/");
  });
};

exports.getSignUp = (req, res) => {
  let message = req.flash("error");
  if (message.length > 0) message = message[0];
  else message = null;
  res.render("auth/signup", {
    pageTitle: "Sign Up",
    path: "/auth/signup",
    isLoggedIn: false,
    errorMessage: message,
  });
};

exports.postSignUp = (req, res) => {
  const name = req.body.userName;
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  User.findOne({ email: email })
    .then((userDoc) => {
      if (userDoc) {
        req.flash(
          "error",
          "E-Mail exists already, please pick a different one."
        );
        return res.redirect("/signup");
      }
      if (password !== confirmPassword) {
        req.flash("error", "Confirm password incorrect");
        return res.redirect("/signup");
      }
      return bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
          const user = new User({
            name: name,
            email: email,
            password: hashedPassword,
            cart: { items: [] },
          });
          return user.save();
        })
        .then((result) => {
          res.redirect("/login");
          return transporter.sendMail({
            from: "hoantran03082003@gmail.com",
            to: email,
            subject: "Signup succeeded!",
            html: "<h1>You successfully signed up!</h1>",
          });
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.getForgotPassword = (req, res) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render("auth/forgotPassword", {
    path: "/auth/forgot-password",
    pageTitle: "Reset Password",
    isLoggedIn: false,
    errorMessage: message,
  });
};

exports.postForgotPassword = (req, res) => {
  crypto.randomBytes(32, (error, buffer) => {
    if (error) {
      return res.redirect("/forgot-password");
    }
    const token = buffer.toString("hex");
    const tokenExpired = Date.now() + 3600000;

    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that Email !");
          return res.redirect("/forgot-password");
        }
        user.resetToken = token;
        user.resetExpiredTime = tokenExpired;
        return user.save().then((result) => {
          // send mail
          console.log("sending email");
          return transporter.sendMail({
            from: "hoantran03082003@gmail.com",
            to: req.body.email,
            subject: "Reset password",
            html: `<p>You request to reset password</p>
            <p>please click to link below to reset your password</p>
            <a href="http://localhost:3000/reset/${token}">http://localhost:3000/reset/${token}<a/>
            `,
          });
        });
      })
      .then((result) => {
        console.log("mail is sent");
      })
      .catch((error) => {
        console.log(error);
      });
  });
};

exports.getReset = (req, res) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    isLoggedIn: false,
    errorMessage: message,
    resetToken: req.params.resetPasswordToken,
  });
};

exports.postReset = (req, res) => {
  const resetToken = req.body.resetToken;
  const newPassword = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;

  if (newPassword !== confirmPassword) {
    req.flash("error", "Password Confirm is not correct ! ");
    console.log(`password incorrect`);
    return res.redirect(`/reset/${resetToken}`);
  }
  User.findOne({ resetToken: resetToken })
    .then((user) => {
      user.password = req.body.newPassword;
      return user.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((error) => {
      console.log(error);
    });
};
