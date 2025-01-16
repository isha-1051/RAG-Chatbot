import { useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import data from "../../scripts/Product.json";

function ExampleData() {
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <Button variant="primary" onClick={handleShow}>
        View Data
      </Button>

      <Modal show={show} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="text-center">Products Data</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-auto" style={{ height: "60vh" }}>
          <table style={{}}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Discount</th>
                <th>Quantity</th>
                <th>Description</th>
                <th>Rating</th>
                <th>Brand</th>
                {/* <th>SKU</th> */}
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.name}</td>
                  <td>{item.category}</td>
                  <td>${item.price}</td>
                  <td>{item.discount}%</td>
                  <td>{item.quantity}</td>
                  <td>{item.description}</td>
                  <td>{item.rating}</td>
                  <td>{item.brand}</td>
                  {/* <td>{item.sku}</td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default ExampleData;
