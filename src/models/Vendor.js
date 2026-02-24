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
        field: "cafeteriaid",
        comment: "Link to cafeteria (one vendor per cafeteria)",
      },
      vendorId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: "vendorid",
        comment: "Internal vendor ID (VENDOR_<cafeteriaId>)",
      },
      cashfreeVendorId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        field: "cashfreevendorid",
        comment: "Cashfree vendor ID returned after registration",
      },
      vendorName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "vendorname",
        comment: "Business/Cafeteria name",
      },
      vendorEmail: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "vendoremail",
        comment: "Admin email for this cafeteria",
      },
      vendorPhone: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "vendorphone",
        comment: "Admin phone number",
      },
      accountHolderName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "accountholdername",
        comment: "Bank account holder name",
      },
      accountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "accountnumber",
        comment: "Bank account number",
      },
      ifscCode: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "ifsccode",
        comment: "Bank IFSC code",
      },
      bankName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: "bankname",
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
        field: "kycdocuments",
        comment: "Store KYC document URLs (PAN, GST, etc.)",
      },
      activatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "activatedat",
        comment: "When Cashfree approved and activated vendor",
      },
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "rejectionreason",
        comment: "Reason if vendor KYC was rejected",
      },

      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },

      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      tableName: "vendors",
      timestamps: true,
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["cafeteriaid"], unique: true },
        { fields: ["vendorid"], unique: true },
        { fields: ["cashfreevendorid"], unique: true },
        { fields: ["status"] },
      ],
    }
  );

  return Vendor;
};
