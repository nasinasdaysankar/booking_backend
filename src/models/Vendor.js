import { DataTypes } from "sequelize";

export default (sequelize) => {
  const Vendor = sequelize.define(
    "Vendor",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      cafeteriaId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        comment: "Link to cafeteria (one vendor per cafeteria)",
      },
      vendorId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: "Internal vendor ID (VENDOR_<cafeteriaId>)",
      },
      cashfreeVendorId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        comment: "Cashfree vendor ID returned after registration",
      },
      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Business/Cafeteria name",
      },
      vendorEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Admin email for this cafeteria",
      },
      vendorPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Admin phone number",
      },
      accountHolderName: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Bank account holder name",
      },
      accountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Bank account number",
      },
      ifscCode: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Bank IFSC code",
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "Bank name",
      },
      status: {
        type: DataTypes.ENUM(
          "PENDING_KYC",
          "KYC_SUBMITTED",
          "ACTIVE",
          "SUSPENDED",
          "REJECTED"
        ),
        defaultValue: "PENDING_KYC",
        comment: "Vendor activation status",
      },
      kycDocuments: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: "Store KYC document URLs (PAN, GST, etc.)",
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: "When Cashfree approved and activated vendor",
      },
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Reason if vendor KYC was rejected",
      },
    },
    {
      tableName: "vendors",
      timestamps: true,
      indexes: [
        { fields: ["cafeteriaId"], unique: true },
        { fields: ["vendorId"], unique: true },
        { fields: ["cashfreeVendorId"], unique: true },
        { fields: ["status"] },
      ],
    }
  );

  return Vendor;
};
