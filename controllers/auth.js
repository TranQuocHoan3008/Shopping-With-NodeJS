const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { validationResult } = require("express-validator");
require("express-async-errors");

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
    email: "",
    errors: [],
    password: "",
  });
};

exports.postLogin = async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  // all errors in Routes folder
  const errorValidation = validationResult(req);

  // whether exist any errors
  if (!errorValidation.isEmpty()) {
    // error message
    const message = `${validationResult(req).errors[0].msg}    
    ${validationResult(req).errors[0].path}`;
    // rerender with error
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      path: "/auth/login",
      isLoggedIn: false,
      errorMessage: message,
      email: email,
      password: password,
      errors: validationResult(req).array(),
    });
  }

  //find user with email in the request of form
  const user = await User.findOne({
    email: email,
  });
  // we don't need to check user exist because we have checked in Routes

  // hash the password and compare with password in the database
  const passwordIsMatch = await bcrypt.compare(password, user.password);

  if (passwordIsMatch) {
    //if password matched, save the session in the request and save session to the database
    req.session.isLoggedIn = true;
    req.session.user = user;
    return req.session.save((error) => {
      res.redirect("/");
    });
  }

  // whether we need to rerender with error message
  const message = "Wrong email or password.";
  return res.status(422).render("auth/login", {
    pageTitle: "Login",
    path: "/auth/login",
    isLoggedIn: false,
    errorMessage: message,
    email: email,
    errors: [],
    password: password,
  });
};

exports.postLogout = (req, res) => {
  req.session.user = new User().init(req.session.user);
  req.session.destroy((error) => {
    res.redirect("/login");
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
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
};

exports.postSignUp = async (req, res) => {
  try {
    const name = req.body.userName;
    const email = req.body.email;
    const password = req.body.password;
    const errorValidation = validationResult(req);
    const confirmPassword = req.body.confirmPassword;
    if (password !== confirmPassword) {
      return res.status(422).render("auth/signup", {
        pageTitle: "Sign Up",
        path: "/auth/signup",
        isLoggedIn: false,
        errorMessage: "Password and confirm password not match",
        email: email,
        password: password,
        name: name,
        confirmPassword: confirmPassword,
      });
    }
    if (!errorValidation.isEmpty()) {
      const message = `${validationResult(req).errors[0].msg}    
    ${validationResult(req).errors[0].path}`;
      return res.status(422).render("auth/signup", {
        pageTitle: "Sign Up",
        path: "/auth/signup",
        isLoggedIn: false,
        errorMessage: message,
        email: email,
        password: password,
        name: name,
        confirmPassword: confirmPassword,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      name: name,
      email: email,
      password: hashedPassword,
      cart: { items: [] },
    });
    await user.save();

    res.redirect("/login");
    return transporter.sendMail({
      from: "hoantran03082003@gmail.com",
      to: email,
      subject: "Signup succeeded!",
      html: "<h1>You successfully signed up!</h1>",
    });
  } catch (error) {
    throw new ServerDown("Can not save Product to database");
  }
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
  try {
    crypto.randomBytes(32, async (error, buffer) => {
      if (error) {
        return res.redirect("/forgot-password");
      }
      const token = buffer.toString("hex");
      const tokenExpired = Date.now() + 3600000;

      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        req.flash("error", "No account with that Email !");
        return res.redirect("/forgot-password");
      }
      user.resetToken = token;
      user.resetExpiredTime = tokenExpired;
      await user.save();
      // send mail
      transporter.sendMail({
        from: "hoantran03082003@gmail.com",
        to: req.body.email,
        subject: "Reset password",
        html: `<p>You request to reset password</p>
              <p>please click to link below to reset your password</p>
              <a href="http://localhost:3000/reset/${token}">http://localhost:3000/reset/${token}<a/>
              `,
      });
      res.render("notice", {
        path: "/reset",
        pageTitle: "Reset Password",
        isLoggedIn: false,
      });
    });
  } catch (error) {
    throw new ServerDown("Can not save Product to database");
  }
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

exports.postReset = async (req, res) => {
  try {
    const resetToken = req.body.resetToken;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    let userOld;

    if (newPassword !== confirmPassword) {
      req.flash("error", "Password Confirm is not correct ! ");
      return res.redirect(`/reset/${resetToken}`);
    }

    const user = await User.findOne({ resetToken: resetToken });
    if (user.resetExpiredTime <= Date.now()) {
      req.flash("error", "Reset Token Was Expired ! ");
      return res.redirect("/login");
    }
    userOld = user;
    const hashPass = await bcrypt.hash(req.body.newPassword, 12);
    userOld.password = hashPass;
    await userOld.save();
    res.redirect("/login");
  } catch (error) {
    throw new ServerDown("Can not save Product to database");
  }
};
