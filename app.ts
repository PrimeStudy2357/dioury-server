import dotenv from "dotenv";

const result = dotenv.config();
if (result.error) {
  console.error(".env 파일을 찾을 수 없습니다!", result.error);
} else {
  console.log("----------------------------");
  console.log(".env 로드 성공:", result.parsed);
  console.log("----------------------------");
}

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import session from "express-session";
import { RedisStore } from "connect-redis";
import redisClient from "./services/connectors/redis.service";
import logger from "morgan";
import createError from "http-errors";

import indexRouter from "./routes/index";
import usersRouter from "./routes/user.route";
import signUpRouter from "./routes/signup.route";
import signInRouter from "./routes/signin.route";

const isProd = process.env.NODE_ENV === "production";

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// 세션 설정
app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: "dioury-loginSession-",
    }),
    secret: process.env.SESSION_STORAGE_SECRET ?? "",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: isProd ? "none" : "lax",
    },
  }),
);

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/signup", signUpRouter);
app.use("/signin", signInRouter);

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

export default app;

