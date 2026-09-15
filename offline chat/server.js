const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

const users = new Map();

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join room", ({ username, room }) => {
        username = String(username || "Anonymous").trim().slice(0, 20);
        room = String(room || "general").trim().slice(0, 30);

        if (!username) username = "Anonymous";
        if (!room) room = "general";

        socket.join(room);

        users.set(socket.id, {
            username,
            room
        });

        socket.data.username = username;
        socket.data.room = room;

        socket.emit("joined room", {
            username,
            room
        });

        socket.to(room).emit("system message", {
            text: `${username} joined the room`,
            time: new Date().toISOString()
        });

        sendRoomUsers(room);
    });

    socket.on("chat message", (message) => {
        const user = users.get(socket.id);

        if (!user) return;

        message = String(message || "").trim();

        if (!message) return;

        message = message.slice(0, 500);

        io.to(user.room).emit("chat message", {
            username: user.username,
            message,
            time: new Date().toISOString(),
            socketId: socket.id
        });
    });

    socket.on("typing", () => {
        const user = users.get(socket.id);

        if (!user) return;

        socket.to(user.room).emit("typing", {
            username: user.username
        });
    });

    socket.on("stop typing", () => {
        const user = users.get(socket.id);

        if (!user) return;

        socket.to(user.room).emit("stop typing");
    });

    socket.on("disconnect", () => {
        const user = users.get(socket.id);

        if (user) {
            socket.to(user.room).emit("system message", {
                text: `${user.username} left the room`,
                time: new Date().toISOString()
            });

            users.delete(socket.id);
            sendRoomUsers(user.room);
        }

        console.log("User disconnected:", socket.id);
    });
});

function sendRoomUsers(room) {
    const roomUsers = [];

    for (const user of users.values()) {
        if (user.room === room) {
            roomUsers.push(user.username);
        }
    }

    io.to(room).emit("room users", {
        count: roomUsers.length,
        users: roomUsers
    });
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Link Chat server running on port ${PORT}`);
});
