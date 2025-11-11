import io
import os
import threading
from typing import Optional, Tuple
import numpy as np
from PIL import Image, ImageOps


BCH_POLYNOMIAL = 137
BCH_BITS = 5


class ModelRunner:
    """Loads a SavedModel once and provides encode/decode helpers.

    This class is NOT thread-safe; guard calls with an external lock.
    """

    def __init__(self) -> None:
        # Lazy TensorFlow import/handles
        self._tf = None
        self._tag_constants = None
        self._signature_constants = None
        self._graph = None
        self._sess = None
        self._model_dir: Optional[str] = None

        # Tensor handles
        self._input_secret = None
        self._input_image = None
        self._output_stegastamp = None
        self._output_residual = None
        self._output_decoded = None

        # BCH codec (lazy)
        self._bch = None

    @property
    def model_dir(self) -> Optional[str]:
        return self._model_dir

    def _close(self) -> None:
        try:
            if self._sess is not None:
                self._sess.close()
        finally:
            self._sess = None
            self._graph = None
            self._input_secret = None
            self._input_image = None
            self._output_stegastamp = None
            self._output_residual = None
            self._output_decoded = None

    def load(self, model_dir: str) -> None:
        if self._model_dir == model_dir and self._sess is not None:
            return
        self._close()

        # Lazy import TensorFlow
        if self._tf is None:
            try:
                import tensorflow as tf  # type: ignore
                from tensorflow.python.saved_model import tag_constants  # type: ignore
                from tensorflow.python.saved_model import signature_constants  # type: ignore
                self._tf = tf
                self._tag_constants = tag_constants
                self._signature_constants = signature_constants
            except Exception as e:
                raise RuntimeError(f'TensorFlow not available: {e}')

        tf = self._tf
        graph = tf.Graph()
        sess = tf.compat.v1.Session(graph=graph)
        with graph.as_default():
            model = tf.compat.v1.saved_model.loader.load(sess, [self._tag_constants.SERVING], model_dir)

            sig = model.signature_def[self._signature_constants.DEFAULT_SERVING_SIGNATURE_DEF_KEY]
            # Inputs
            if 'secret' in sig.inputs:
                input_secret_name = sig.inputs['secret'].name
                self._input_secret = graph.get_tensor_by_name(input_secret_name)
            if 'image' in sig.inputs:
                input_image_name = sig.inputs['image'].name
                self._input_image = graph.get_tensor_by_name(input_image_name)

            # Outputs (encoder)
            if 'stegastamp' in sig.outputs:
                output_stegastamp_name = sig.outputs['stegastamp'].name
                self._output_stegastamp = graph.get_tensor_by_name(output_stegastamp_name)
            if 'residual' in sig.outputs:
                output_residual_name = sig.outputs['residual'].name
                self._output_residual = graph.get_tensor_by_name(output_residual_name)

            # Outputs (decoder)
            if 'decoded' in sig.outputs:
                output_decoded_name = sig.outputs['decoded'].name
                self._output_decoded = graph.get_tensor_by_name(output_decoded_name)

        self._graph = graph
        self._sess = sess
        self._model_dir = model_dir

    def _preprocess_image(self, pil_img: Image.Image) -> np.ndarray:
        image = np.array(ImageOps.fit(pil_img.convert('RGB'), (400, 400)), dtype=np.float32)
        image /= 255.0
        return image

    def _encode_secret_to_bits(self, secret_str: str) -> list:
        if len(secret_str) > 7:
            raise ValueError('Can only encode 56 bits (7 characters) with ECC')
        if self._bch is None:
            try:
                import bchlib  # type: ignore
                self._bch = bchlib.BCH(BCH_POLYNOMIAL, BCH_BITS)
            except Exception as e:
                raise RuntimeError(f'BCH library not available: {e}')
        data = bytearray(secret_str + ' ' * (7 - len(secret_str)), 'utf-8')
        ecc = self._bch.encode(data)
        packet = data + ecc
        packet_binary = ''.join(format(x, '08b') for x in packet)
        bits = [int(x) for x in packet_binary]
        bits.extend([0, 0, 0, 0])
        return bits

    def encode(self, pil_img: Image.Image, secret_str: str) -> Tuple[Image.Image, Image.Image, Image.Image]:
        if self._sess is None or self._graph is None or self._input_secret is None or self._input_image is None:
            raise RuntimeError('Model is not loaded or encoder signatures are missing')

        image = self._preprocess_image(pil_img)
        secret_bits = self._encode_secret_to_bits(secret_str)

        feed = {self._input_secret: [secret_bits], self._input_image: [image]}
        outputs = [self._output_stegastamp, self._output_residual]
        hidden_img, residual = self._sess.run(outputs, feed_dict=feed)

        rescaled = (hidden_img[0] * 255).astype(np.uint8)
        raw_img = (image * 255).astype(np.uint8)
        residual = residual[0] + 0.5
        residual = (residual * 255).astype(np.uint8)

        im_raw = Image.fromarray(np.array(raw_img))
        im_hidden = Image.fromarray(np.array(rescaled))
        im_residual = Image.fromarray(np.squeeze(np.array(residual)))
        return im_hidden, im_raw, im_residual

    def decode(self, pil_img: Image.Image) -> Optional[str]:
        if self._sess is None or self._graph is None or self._input_image is None or self._output_decoded is None:
            raise RuntimeError('Model is not loaded or decoder signatures are missing')

        image = self._preprocess_image(pil_img)
        feed = {self._input_image: [image]}
        secret_bits = self._sess.run([self._output_decoded], feed_dict=feed)[0][0]

        packet_binary = ''.join([str(int(bit)) for bit in secret_bits[:96]])
        packet = bytes(int(packet_binary[i:i + 8], 2) for i in range(0, len(packet_binary), 8))
        packet = bytearray(packet)
        if self._bch is None:
            try:
                import bchlib  # type: ignore
                self._bch = bchlib.BCH(BCH_POLYNOMIAL, BCH_BITS)
            except Exception as e:
                raise RuntimeError(f'BCH library not available: {e}')
        data, ecc = packet[:-self._bch.ecc_bytes], packet[-self._bch.ecc_bytes:]
        bitflips = self._bch.decode_inplace(data, ecc)
        if bitflips != -1:
            try:
                return data.decode('utf-8')
            except Exception:
                return None
        return None


# Global shared state
runner = ModelRunner()
global_lock = threading.Lock()
