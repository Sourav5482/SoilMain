import mongoose from "mongoose";

const RecordSchema = new mongoose.Schema(
  {
    recordKey: { type: String },
    temperature: { type: Number },
    humidity: { type: Number },
    npk: {
      n: { type: Number },
      p: { type: Number },
      k: { type: Number }
    },
    minValues: {
      tempMin: Number,
      humidityMin: Number,
      nMin: Number,
      pMin: Number,
      kMin: Number
    },
    maxValues: {
      tempMax: Number,
      humidityMax: Number,
      nMax: Number,
      pMax: Number,
      kMax: Number
    },
    latitude: Number,
    longitude: Number,
    images: [{ type: String }],
    sensorModes: [{ type: String, enum: ["npk", "humidity", "temp", "all"] }],
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const SoilSchema = new mongoose.Schema(
  {
    refId: { type: String, required: true, index: true, unique: true },
    location: { type: String, default: "" },
    soilType: { type: String, enum: ["Clay", "Sandy", "Loamy", "Silty"], default: "Loamy" },
    records: [RecordSchema]
  },
  { timestamps: true }
);

export const Soil = mongoose.model("Soil", SoilSchema);
