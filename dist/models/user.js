import { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const userSchema = new Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    address: { type: String, required: true },
    role: { type: String, default: "User" },
});
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};
userSchema.methods.generateAuthToken = function () {
    const payload = {
        userId: this._id,
        username: this.username,
        email: this.email,
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};
const User = model("User", userSchema);
export default User;
