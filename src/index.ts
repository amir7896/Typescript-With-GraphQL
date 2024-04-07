import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { config } from "dotenv";
config();
import { connect, Types } from "mongoose";
import User from "../models/user.js";
import mongoose from "mongoose";

mongoose.set("strictQuery", false);

const typeDefs = `#graphql
 type User {
    _id: ID
    username: String
    email: String
    address: String
  }

  input PaginationInput {
    limit: Int
    page: Int
  }

  input FilterInput {
    username: String
    email: String
  }

  type UsersResponse {
    status: Int
    success: Boolean
    data: [User]
    pageInfo: PageInfo
  }

  type PageInfo {
    totalUsers: Int
    totalPages: Int
    currentPage: Int
  }

  type Query {
    getUser(ID: ID!): User
    getUsers(pagination: PaginationInput, filter: FilterInput): UsersResponse!
  }

  input UserInput {
    username: String
    email: String
    password: String
    address: String
  }

  type Mutation {
    createUser(userInput: UserInput): User!
    loginUser(email: String!, password: String!): String!
    updateUser(ID: ID!, userInput: UserInput): User!
    deleteUser(ID: ID!): String!
  }
`;

const resolvers = {
  Query: {
    async getUser(_, { ID }) {
      try {
        const user = await User.findById(ID);
        if (!user) {
          throw new Error("User not found");
        }
        return { status: 200, success: true, data: user };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Server Error",
          error: error.message,
        };
      }
    },
    async getUsers(_, { pagination, filter }) {
      try {
        const { limit, page } = pagination || {};
        const { username, email } = filter || {};
        const query = {};
        if (username) {
          query["username"] = username;
        }
        if (email) {
          query["email"] = email;
        }
        const usersQuery = User.find(query);
        if (limit) {
          usersQuery.limit(limit);
        }
        if (page) {
          usersQuery.skip((page - 1) * (limit || 0));
        }
        const users = await usersQuery.exec();
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / (limit || 10));
        return {
          status: 200,
          success: true,
          data: users,
          pageInfo: { totalUsers, totalPages, currentPage: page },
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
    async createUser(_, { userInput }) {
      try {
        const { username, email, password, address } = userInput;
        const user = new User({ username, email, password, address });
        await user.save();
        return {
          status: 201,
          success: true,
          message: "User created successfully",
          data: user,
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Internal Server Error",
          error: error.message,
        };
      }
    },
    async loginUser(_, { email, password }) {
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
        return { status: 200, success: true, data: { user, token } };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Internal Server Error",
          error: error.message,
        };
      }
    },
    async updateUser(_, { ID, userInput }) {
      try {
        const user = await User.findById(ID);
        if (!user) {
          throw new Error("User not found");
        }
        const { username, email, password, address } = userInput;
        user.username = username;
        user.email = email;
        user.password = password;
        user.address = address;
        await user.save();
        return {
          status: 200,
          success: true,
          message: "User updated successfully",
          data: user,
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Internal Server Error",
          error: error.message,
        };
      }
    },
    async deleteUser(_, { ID }) {
      try {
        const user = await User.findByIdAndDelete(ID);
        if (!user) {
          throw new Error("User not found");
        }
        return {
          status: 200,
          success: true,
          message: "User deleted successfully",
        };
      } catch (error) {
        return {
          status: 500,
          success: false,
          message: "Internal Server Error",
          error: error.message,
        };
      }
    },
  },
};

await connect(process.env.DB_URL)
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
});

const port = Number.parseInt(process.env.PORT);

const { url } = await startStandaloneServer(server, {
  listen: { port: port },
});

console.log(`Server is ready at ${url}`);
