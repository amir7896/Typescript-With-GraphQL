import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { config } from "dotenv";
config();
import { connect } from "mongoose";
import User from "../models/user.js";
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import jwt from "jsonwebtoken";

mongoose.set("strictQuery", false);

const typeDefs = `#graphql

 type User {
    _id: ID
    username: String
    email: String
    address: String
    role: String
  }

  input PaginationInput {
    limit: Int
    page: Int
  }

  input SortInput {
    sortBy: String
  }

  type UsersResponse {
    status: Int
    success: Boolean
    data: [User]
    pageInfo: PageInfo
    message:String
  }

  type UserCreateResponse {
    status: Int
    success: Boolean
    message: String
    data: User
  }

  type LgoinResponse {
    status: Int
    success: Boolean
    user: User
    token: String
    message:String
  }

  type SingleUserResponse  {
    status: Int
    success: Boolean
    user: User
  }

  type UserUpdateDeleteResponse  {
    status: Int
    success: Boolean
    message: String
    user: User
  }

  type PageInfo {
    totalUsers: Int
    totalPages: Int
    currentPage: Int
  }

  type Query {
    getUser(ID: ID!): SingleUserResponse!
    getUsers(pagination: PaginationInput, sort: SortInput): UsersResponse!
  }

  input UserInput {
    username: String
    email: String
    password: String
    address: String
  }

  input UpdateUserInput {
    username: String
    email: String
    address: String
  }

  type Mutation {
    createUser(userInput: UserInput): UserCreateResponse!
    loginUser(email: String!, password: String!): LgoinResponse!
    updateUser(ID: ID!, userInput: UpdateUserInput): UserUpdateDeleteResponse!
    deleteUser(ID: ID!): UserUpdateDeleteResponse!
  }
`;

const resolvers = {
  Query: {
    async getUser(_: any, { ID }, { user }) {
      try {
        if (user.role !== "Admin") {
          return {
            success: false,
            status: 403,
            message: "Forbidden",
          };
        }

        const singleUser = await User.findById(ID);
        if (!singleUser) {
          throw new Error("User not found");
        }
        return { status: 200, success: true, user: singleUser };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Server Error",
          error: error.message,
        };
      }
    },
    async getUsers(_: any, { pagination, sort }, { user }) {
      try {
        const { limit, page } = pagination || {};
        const { sortBy } = sort || {};
        if (user.role !== "Admin") {
          return {
            success: false,
            status: 403,
            message: "Forbidden",
          };
        }
        const usersQuery = User.find();

        if (sortBy) {
          usersQuery.sort(sortBy);
        }

        if (limit) {
          usersQuery.limit(limit);
        }
        if (page) {
          usersQuery.skip((page - 1) * (limit || 0));
        }

        const users = await usersQuery.exec();
        const totalUsers = await User.countDocuments();
        const totalPages = Math.ceil(totalUsers / (limit || 10));
        return {
          status: 200,
          success: true,
          data: users,
          pageInfo: { totalUsers, totalPages, currentPage: page },
          message: null,
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Server Error",
          error: error.message,
        };
      }
    },
  },
  Mutation: {
    async createUser(_: any, { userInput }, { user }) {
      try {
        if (user.role !== "Admin") {
          return {
            success: false,
            status: 403,
            message: "Forbidden",
          };
        }
        const { username, email, password, address } = userInput;
        const createdUser = new User({ username, email, password, address });

        await createdUser.save();
        return {
          status: 201,
          success: true,
          message: "User created successfully",
          data: user,
        };
      } catch (error) {
        if (error.name === "MongoServerError" && error.code === 11000) {
          return {
            status: 400,
            success: false,
            message: "Email already exists",
            error: error.message,
          };
        } else {
          return {
            status: 500,
            success: false,
            message: "Internal Server Error",
            error: error.message,
          };
        }
      }
    },
    async loginUser(_: any, { email, password }) {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          throw new Error("User not found");
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }
        const token = user.generateAuthToken();
        return {
          status: 200,
          success: true,
          user: user,
          token: token,
          userData: user,
          message: "Login successfully",
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: error.message,
        };
      }
    },
    async updateUser(_: any, { ID, userInput }, { user }) {
      try {
        if (user.role !== "Admin") {
          return {
            success: false,
            status: 403,
            message: "Forbidden",
          };
        }
        const singleUser = await User.findById(ID);
        if (!singleUser) {
          throw new Error("User not found");
        }
        const { username, email, address } = userInput;
        singleUser.username = username;
        singleUser.email = email;
        singleUser.address = address;
        await singleUser.save();
        return {
          status: 200,
          success: true,
          message: "User updated successfully",
          user: singleUser,
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: error.message,
        };
      }
    },
    async deleteUser(_: any, { ID }, { user }) {
      try {
        if (user.role !== "Admin") {
          return {
            success: false,
            status: 403,
            message: "Forbidden",
          };
        }
        const deletedUser = await User.findByIdAndDelete(ID);
        if (!deletedUser) {
          throw new Error("User not found");
        }
        return {
          status: 200,
          success: true,
          message: "User deleted successfully",
          user: deletedUser,
        };
      } catch (error) {
        console.log("Deleted Error:", error);
        return {
          status: 500,
          success: false,
          message: error.message,
        };
      }
    },
  },
};

await connect(process.env.DB_URL2)
  .then((res) => {
    if (res) {
      console.log("Connected to database successfully");
    }
  })
  .catch((err) => {
    console.log("Database connection error:", err);
  });

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const port = Number.parseInt(process.env.PORT);

const { url } = await startStandaloneServer(server, {
  context: async ({ req, res }) => {
    const token = req.headers.authorization.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof decoded === "string" || !("userId" in decoded)) {
          throw new GraphQLError("Invalid token", {
            extensions: {
              code: "INVALID_TOKEN",
              http: { status: 401 },
            },
          });
        }
        const userId = decoded.userId as string;
        const user = await User.findById(userId);

        return { token, user };
      } catch (error) {
        throw new GraphQLError("Invalid token", {
          extensions: {
            code: "INVALID_TOKEN",
            http: { status: 401 },
          },
        });
      }
    }
  },

  listen: { port: port },
});

console.log(`Server is ready at ${url}`);
