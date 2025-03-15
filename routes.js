import express from "express";

const router = express.Router();
import Product from "./productSchema.js";
import Order from "./orderSchema.js";

//aws s3
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
const orderProcessingBucket = new S3Client({ region: "ap-south-1" });
//aws sns
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
const snsNotification = new SNSClient({ region: "ap-south-1" });
//sqs
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
const sqsQueue = new SQSClient({ region: "ap-south-1" });
//ses
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
const sesQueue = new SESClient({region:'ap-south-1'})

router.post("/addproducts", async (req, res) => {
  try {
    let { name, price, stock, description, category } = req.body;
    // Check for required fields
    if (!name || !price || !stock) {
      return res.status(400).json({
        message: "Missing required fields: name, price, and stock are required",
      });
    }
    const checkproductExist = await Product.find({ name: req.body.name });
    console.log(checkproductExist);

    if (checkproductExist.length > 0) {
      return res.status(409).json({
        message: " product already avilable",
      });
    }
    let newProduct = new Product({
      name,
      price,
      stock,
      description,
      category,
    });

    const toCreateProduct = await newProduct.save();
    console.log(toCreateProduct._id);

    res
      .status(201)
      .json({ sucess: "product created :", data: toCreateProduct });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "error in server" });
  }
});

router.post("/placeorder", async (req, res) => {
  try {
    let { email, items, totalAmount } = req.body;
    const orderdetails = new Order({
      email,
      items,
      totalAmount,
      invoiceUrl: null,
    });


    const PlaceOrder = await orderdetails.save();
    if (!PlaceOrder) {
      return res.status(404).json({ message: "No data in MongoDB" });
    }

   
    
  

    // Store the order details to S3
    const orderSummary = {
      orderId: PlaceOrder._id,
      email: PlaceOrder.email,
      createdAt: PlaceOrder.createdAt,
    };
    //console.log("orderSummery",orderSummary);

    const filePath = `orders/${PlaceOrder.email}/${orderSummary.orderId}.json`;
    const tosaveToS3 = new PutObjectCommand({
      Bucket:process.env.S3BUCKET,

      Key: filePath,
      Body: JSON.stringify(orderSummary),
    });

    console.log("File saved to S3: ", tosaveToS3);

    const command = await orderProcessingBucket.send(tosaveToS3);
    console.log("File saved to S3 in variable command: ", command);

    if (!command) {
      return res.status(404).json({ message: "No data in S3" });
    }

    // Send sns notification for order processing
    const snsParams = {
      Message: PlaceOrder._id.toString(), // Send only the orderId as string
    };

    console.log(snsParams, "///////////////////////");

    const response = new PublishCommand({
      Message: snsParams.Message,
      TopicArn:process.env.TOPICARN,
    });

    const dataForSns = await snsNotification.send(response);
    console.log("SNS data sent:", dataForSns);

    res.status(200).json({
      message:
        "Data uploaded to MongoDB, S3, and SNS notification has been sent",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
});

//**************************************************************************************************************************** */

const sqsDemon = async () => {
  try {
    const command = new ReceiveMessageCommand({
      QueueUrl: process.env.QUEUEURL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20,
    });

    const snsMessage = await sqsQueue.send(command);
    console.log("Message received in SQS:", snsMessage);

    if (!snsMessage.Messages || snsMessage.Messages.length === 0) {
      return "No messages in SQS";
    }

    for (const message of snsMessage.Messages) {
      if (message.Body) {
        try {
          // Parse the Body, which is a JSON string
          const parsedBody = JSON.parse(message.Body);
          console.log("Parsed Body:", parsedBody);

          // Ensure the 'Message' field exists
          if (parsedBody.Message) {
            const orderId = parsedBody.Message;
            console.log("Order ID:", orderId);

            // Retrieve order from MongoDB
            const order = await Order.findById(orderId);

            if (!order) {
              console.log(`Order with ID ${orderId} not found in MongoDB`);
              return;
            }

            // Check and update order status to avoid re-processing
            if (order.status === "Pending") {
              order.status = "Completed";
              await order.save();
              console.log(`Order with ID ${orderId} status updated to Completed`);

              // Send email confirmation only once
              const createSendEmailCommand = new SendEmailCommand({
                Destination: {
                  ToAddresses: ["pranavshaji2244@gmail.com"],
                },
                Message: {
                  Body: {
                    Text: {
                      Charset: "UTF-8",
                      Data: `Your order with ID ${orderId} has been received and processed.`,
                    },
                  },
                  Subject: {
                    Charset: "UTF-8",
                    Data: "Order Received and Processed",
                  },
                },
                Source: "pranavshaji2244@gmail.com",
              });

              const sendEmailConfirmation = await sesQueue.send(createSendEmailCommand);
              console.log("Email sent:", sendEmailConfirmation);
            }

            // Delete the SQS message after successful processing
            const deleteCommand = new DeleteMessageCommand({
              QueueUrl: process.env.QUEUEURL,
              ReceiptHandle: message.ReceiptHandle,
            });
            await sqsQueue.send(deleteCommand);
            console.log(`Message with ID ${message.MessageId} deleted from SQS`);
          } else {
            console.log("Message field is missing in Body:", parsedBody);
          }
        } catch (err) {
          console.error("Error parsing message Body:", err);
        }
      } else {
        console.log("No Body in message:", message);
      }
    }
  } catch (err) {
    console.error("Error processing SQS message:", err);
    return "Error during SQS processing";
  }
};



const runSqsDemon = async () => {
  while (true) {
    try {
      const result = await sqsDemon();
      console.log("Result from SQS Demon:", result);
    } catch (error) {
      console.error("Error in SQS Demon:", error);
    }
    
    // Add a delay to prevent excessive requests (5 seconds)
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
};

runSqsDemon(); // Start the daemon


// runSqsDemon();

export default router;
