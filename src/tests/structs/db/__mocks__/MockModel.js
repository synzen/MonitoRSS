const MockModel = jest.fn()
MockModel.prototype.save = jest.fn()
MockModel.findOne = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.findByIdAndUpdate = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.findById = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.find = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.deleteOne = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.deleteMany = jest.fn(() => ({ exec: async () => Promise.resolve() }))
MockModel.collection = {
  collectionName: 123
}

module.exports = MockModel
