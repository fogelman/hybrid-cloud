const axios = require("axios");
require("dotenv/config");

const api = axios.create({
  baseURL: process.env.BASE_URL
});

module.exports.add = async (title, description, done = false) => {
  await api.post("/tarefa", { title, description, done }).catch(e => {
    throw "A new todo couldn't be added";
  });
  return;
};

module.exports.delete = async id => {
  await api.delete(`/tarefa/${id}`).catch(e => {
    throw `The todo with id: ${id} couldn't be deleted`;
  });
  return;
};

module.exports.update = async (id, title, description, done = false) => {
  console.log(id, title, description, done);
  await api.put(`/tarefa/${id}`, { title, description, done }).catch(e => {
    throw `The todo with id: ${id} couldn't be updated`;
  });
  return;
};

module.exports.list = async () => {
  return await api
    .get(`/tarefa/`)
    .catch(e => {
      throw `Couln't list todos`;
    })
    .then(({ data }) => data);
};

module.exports.get = async id => {
  return await api
    .get(`/tarefa/${id}`)
    .catch(e => {
      throw `Couln't find todo`;
    })
    .then(({ data }) => data);
};
