function validateMachineId(req, res, next) {
  const { id } = req.params;

  // Only accept positive whole-number IDs
  if (!/^[1-9]\d*$/.test(id)) {
    return res.status(400).json({
      error: "Invalid machine ID"
    });
  }

  next();
}
